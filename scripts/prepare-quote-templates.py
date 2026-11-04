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
for custom_terms,no_consultation,name in [(False,False,'collection-base'),(True,False,'collection-terms'),(False,True,'collection-no-consultation-base'),(True,True,'collection-no-consultation-terms')]:
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
    if no_consultation:
        # Illustrator paints the advisory label twice (fill and stroke). Remove
        # both text objects while preserving surrounding clipping/graphics state.
        blocks=list(re.finditer(rb'BT\b[\s\S]*?\bET\b',content))
        advisory=[block for block in blocks if b'(DESCUENTO POR ASESOR\\315A)' in block.group()]
        assert len(advisory)==2
        for block in reversed(advisory):content=content[:block.start()]+content[block.end():]
        # Place TOTAL on the second line and shorten the original border by the
        # same amount. Keep the subtotal and all artwork outside the box intact.
        assert content.count(b'52.2881 178.0059 Tm')==2
        content=content.replace(b'52.2881 178.0059 Tm',b'52.2881 205.4902 Tm')
        border=next(row[0] for row in page.get_xobjects() if row[1]=='Fm1')
        border_content=doc.xref_stream(border)
        assert border_content.count(b'558.531 165.217 -521.787 94.063 re')==1
        doc.update_stream(border,border_content.replace(b'558.531 165.217 -521.787 94.063 re',b'558.531 192.7013 -521.787 66.5787 re'))
    xref=doc.get_new_xref();doc.update_object(xref,'<<>>');doc.update_stream(xref,content)
    page.set_contents(xref);doc.save(ROOT/(name+'.pdf'),garbage=4,deflate=True)
