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
# New collection proposal: preserve all 10 original pages and clear only the
# sample amounts on page 8. All coordinates, artwork and static fonts stay intact.
for no_consultation,name in [(False,'collection-base'),(True,'collection-no-consultation-base')]:
    doc=fitz.open(ROOT/'collection.pdf');page=doc[7]
    content=page.read_contents()
    samples=[b'[(350)31 (.)31 (000    )]TJ',b'[(40)31 (.)31 (000)]TJ',b'[(3)10 (10)31 (.)31 (000)]TJ']
    for sample in samples:
        assert content.count(sample)==1,sample
        content=content.replace(sample,b'[]TJ')
    if no_consultation:
        labels=[b'[(SUB)23 (T)31 (O)61 (T)173 (AL)]TJ',b'[(DES)8 (CUENT)30.9 (O POR A)31 (SES)8 (OR\\315A)]TJ']
        for label in labels:
            assert content.count(label)==1,label
            content=content.replace(label,b'[]TJ')
        # Preserve text advances and the last ARS label beside TOTAL. Only the
        # subtotal/advisory currency labels disappear, along with their amounts.
        currency=b'[(A)-7 (RS)]TJ'
        assert content.count(currency)==3
        content=content.replace(currency,b'[]TJ',2)
    xref=doc.get_new_xref();doc.update_object(xref,'<<>>');doc.update_stream(xref,content)
    page.set_contents(xref);doc.save(ROOT/(name+'.pdf'),garbage=4,deflate=True)
