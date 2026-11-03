"""Prepare editable zones without changing original PDFs, fonts or watermarks.
Development only: requires PyMuPDF. Runtime uses the prepared PDF assets.
"""
from pathlib import Path
import fitz
ROOT=Path(__file__).resolve().parent.parent/'templates'
import re
for grid,terms,name in [(True,False,'design-grid'),(False,True,'design-terms'),(True,True,'design-grid-terms')]:
    doc=fitz.open(ROOT/'design.pdf');page=doc[0]
    # Remove only known grid/text Form XObject invocations. Preserve Illustrator's
    # graphics states and clipping verbatim; graphical redaction changes its opacity.
    names=(['Fm8','Fm9','Fm10','Fm11','Fm12'] if grid else [])+(['Fm3','Fm4','Fm5','Fm6','Fm14'] if terms else [])
    content=page.read_contents()
    for obj in names:
        pattern=rb'/'+obj.encode()+rb'\s+Do\b'
        content,count=re.subn(pattern,b'',content)
        assert count==1,(obj,count)
    xref=doc.get_new_xref();doc.update_object(xref,'<<>>');doc.update_stream(xref,content)
    page.set_contents(xref);doc.save(ROOT/(name+'.pdf'),garbage=4,deflate=True)
for custom_terms,name in [(False,'collection-base'),(True,'collection-terms')]:
    doc=fitz.open(ROOT/'collection.pdf');page=doc[0]
    # Replace the underscore glyphs with their exact text advance. The number
    # keeps its original position without painting over the translucent artwork.
    spans=[span for block in page.get_text('rawdict')['blocks'] for line in block.get('lines',[]) for span in line['spans']]
    span=next(span for span in spans if '_________' in ''.join(c['c'] for c in span['chars']))
    chars=span['chars'];start=''.join(c['c'] for c in chars).index('_________')
    advance=chars[start+9]['origin'][0]-chars[start]['origin'][0]
    adjustment=-advance/span['size']*1000
    content=page.read_contents()
    assert content.count(b'(e _________  ti)')==1
    content=content.replace(b'(e _________  ti)',f'(e ) {adjustment:.6f} (  ti)'.encode())
    if custom_terms:
        content,count=re.subn(rb'/Fm3\s+Do\b',b'',content);assert count==1
    xref=doc.get_new_xref();doc.update_object(xref,'<<>>');doc.update_stream(xref,content)
    page.set_contents(xref);doc.save(ROOT/(name+'.pdf'),garbage=4,deflate=True)
