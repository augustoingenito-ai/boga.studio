"""Extract the supplied manual's logo and page-5 artwork as unchanged vectors.
Development only: python scripts/prepare-ui-brand.py '/path/to/MANUAL DE MARCA.pdf'
Requires PyMuPDF, lxml, fontTools and Brotli. Production serves the prepared assets.
"""
from pathlib import Path
from copy import deepcopy
import sys
import fitz
from lxml import etree
from fontTools.ttLib import TTFont

root=Path(__file__).resolve().parent.parent
manual=fitz.open(sys.argv[1])
svg_ns='http://www.w3.org/2000/svg'
ink_ns='http://www.inkscape.org/namespaces/inkscape'
xlink_ns='http://www.w3.org/1999/xlink'
brand=root/'public/brand'

source=etree.fromstring(manual[1].get_svg_image(text_as_path=True).encode())
layer=source.xpath('//*[@ink:label="PAG 2"]',namespaces={'ink':ink_ns})[0]
logo=etree.Element('{%s}svg'%svg_ns,nsmap={None:svg_ns,'xlink':xlink_ns},viewBox='164 256 270 44',width='270',height='44')
etree.SubElement(logo,'{%s}title'%svg_ns).text='BOGA STUDIO'
defs=etree.SubElement(logo,'{%s}defs'%svg_ns)
for path in source.xpath('//*[starts-with(@id,"font_4_")]'):defs.append(deepcopy(path))
for glyph in layer:
    if glyph.get('{%s}href'%xlink_ns,'').startswith('#font_4_'):logo.append(deepcopy(glyph))
studio=layer.xpath('./s:g[@clip-path="url(#clip_5)"]/s:path[@fill="#231f20"]',namespaces={'s':svg_ns})
assert len(studio)==6
for path in studio:logo.append(deepcopy(path))
(brand/'boga-studio-logo.svg').write_bytes(etree.tostring(logo))

art=etree.fromstring(manual[4].get_svg_image(text_as_path=False).encode())
for text in art.xpath('//s:text',namespaces={'s':svg_ns}):text.getparent().remove(text)
for layer in art.xpath('//*[@ink:groupmode="layer"]',namespaces={'ink':ink_ns}):
    if layer.get('{%s}label'%ink_ns)!='PAG 5':layer.getparent().remove(layer)
etree.SubElement(art,'{%s}title'%svg_ns).text='Marca de agua original, manual de marca BOGA, hoja 5'
(brand/'dashboard-watermark.svg').write_bytes(etree.tostring(art))

font=TTFont(root/'templates/Coolvetica-Regular.otf')
font.flavor='woff2'
font.save(root/'public/fonts/coolvetica-regular.woff2')
