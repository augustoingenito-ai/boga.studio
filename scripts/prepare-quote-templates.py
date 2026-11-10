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
# Collection revision: only pages 1, 9 and 10 may receive data. Preserve the
# static prefix/suffix on page 9 and remove duplicated example amounts on 10.
for no_consultation,name in [(False,'collection-base'),(True,'collection-no-consultation-base')]:
    doc=fitz.open(ROOT/'collection.pdf')
    page=doc[8];content=page.read_contents()
    sentence=rb'[(Cr)30 (eaci\363n integr)24 (al de 6  tipolog\355as con v)40 (ariante de color e identidad es)6 (t\351tica.)]TJ'
    replacement=rb'[(Cr)30 (eaci\363n integr)24 (al de )]TJ'+b'\n22.0132 0 0 22.0132 268.7899 381.3359 Tm\n'+rb'[(  tipolog\355as con v)40 (ariante de color e identidad es)6 (t\351tica.)]TJ'
    assert content.count(sentence)==1
    content=content.replace(sentence,replacement)
    xref=doc.get_new_xref();doc.update_object(xref,'<<>>');doc.update_stream(xref,content);page.set_contents(xref)
    page=doc[9];content=page.read_contents()
    for sample in [b'(350.000 ARS)Tj',b'(310.000 ARS)Tj',b'(40.000 ARS)Tj',b'(-)Tj']:
        assert content.count(sample)==2,sample
        content=content.replace(sample,b'[]TJ')
    if no_consultation:
        for label in [rb'[(SUB)23 (T)31 (O)61 (T)173 (AL)]TJ',rb'[(DES)8 (CUENT)30.9 (O POR A)31 (SES)8 (OR\315A)]TJ']:
            assert content.count(label)==1,label
            content=content.replace(label,b'[]TJ')
        # The sole remaining total occupies the first financial row.
        assert content.count(b'258.5117 61.8398 Tm')==1
        content=content.replace(b'258.5117 61.8398 Tm',b'258.5117 129.7348 Tm')
    xref=doc.get_new_xref();doc.update_object(xref,'<<>>');doc.update_stream(xref,content);page.set_contents(xref)
    doc.save(ROOT/(name+'.pdf'),garbage=4,deflate=True)

# Monthly accompaniment: preserve labels and all artwork, clear only sample data.
doc=fitz.open(ROOT/'monthly.pdf');page=doc[0];content=page.read_contents()
for sample,replacement in [
    (b'[(Cli)5 (en)10 (te)10 (:   La)13.9 (ura Lucero - L)29 (y)19 (c F)15.1 (i)4.9 (t)]TJ',b'[(Cli)5 (en)10 (te)10 (:)]TJ'),
    (b'[(F)15 (ec)5 (ha:      1)10 (0)49 (/)40.1 (11)28.9 (/)50.1 (20)10 (26 )]TJ',b'[(F)15 (ec)5 (ha:)]TJ'),
]:
    assert content.count(sample)==1,sample
    content=content.replace(sample,replacement)
assert content.count(b'(590.000 ARS)Tj')==2
content=content.replace(b'(590.000 ARS)Tj',b'[]TJ')
xref=doc.get_new_xref();doc.update_object(xref,'<<>>');doc.update_stream(xref,content);page.set_contents(xref)
doc.save(ROOT/'monthly-base.pdf',garbage=4,deflate=True)
