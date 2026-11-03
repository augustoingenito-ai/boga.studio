import {test,expect} from '@playwright/test';
import {PDFDocument,PDFName,PDFDict,decodePDFRawStream} from 'pdf-lib';
import {quotePDF} from '../quote-pdf.js';
import {designTerms,brandTerms} from '../public/quote-defaults.js';
const base={title:'Identidad Álamo',number:'BG-TEST',date:'2026-11-03',validUntil:'2026-12-03',items:[{service:'Diseño gráfico',quantity:2,price:100000}],total:200000};
test('plantillas originales: tamaños, doce páginas branding y PDF rellenable con valores reales',async()=>{
 for(const [type,pages,terms] of [['Diseño',1,designTerms],['Branding',12,brandTerms]]){
  const result=await quotePDF({...base,type,terms,timeline:['2 días','5 días','2 días','3 días','1 día']},{name:'María Núñez'},{editable:true});const pdf=await PDFDocument.load(result.bytes);expect(pdf.getPageCount()).toBe(pages);expect(pdf.getPage(0).getWidth()>pdf.getPage(0).getHeight()).toBe(type==='Branding');
  const form=pdf.getForm();expect(form.getFields().map(f=>f.getName())).not.toContain('proyecto');expect(pdf.getTitle()).not.toContain(base.title);if(type==='Branding')expect(form.getFields().map(f=>f.getName())).not.toContain('cliente');else expect(form.getTextField('cliente').getText()).toBe('María Núñez');expect(form.getTextField('total').getText()).toBe('$ 200.000');
  if(type==='Branding')expect(form.getTextField('investigacion').getText()).toBe('2 días');
  const editableField=type==='Branding'?'referencia':'cliente';form.getTextField(editableField).setText('Dato editado');const edited=await PDFDocument.load(await pdf.save({updateFieldAppearances:false}));expect(edited.getForm().getTextField(editableField).getText()).toBe('Dato editado');
  const final=await PDFDocument.load((await quotePDF({...base,type,terms},{name:'María Núñez'})).bytes);expect(final.getForm().getFields()).toHaveLength(0);expect(final.getPageCount()).toBe(pages);for(const page of final.getPages())for(const ref of page.node.Annots()?.asArray()||[])expect(final.context.lookup(ref)).toBeDefined();
 }
});
test('diseño: cuatro servicios se descargan en una hoja sin perder filas',async()=>{
 const q={...base,type:'Diseño',terms:designTerms,items:Array.from({length:4},(_,i)=>({service:'Servicio '+(i+1),quantity:1,price:50000}))};const pdf=await PDFDocument.load((await quotePDF(q,{name:'Cliente'},{editable:true})).bytes);expect(pdf.getPageCount()).toBe(1);const form=pdf.getForm();expect(form.getTextField('servicio_4').getText()).toBe('Servicio 4');expect(form.getTextField('total').acroField.getWidgets()).toHaveLength(1);expect(form.getTextField('cliente').acroField.getWidgets()).toHaveLength(1);
});
test('branding conserva los anexos para contenido extenso',async()=>{
 const text='Condición personalizada con ñ y acentos. '.repeat(110);const pdf=await PDFDocument.load((await quotePDF({...base,type:'Branding',terms:text,description:'Nota importante',items:[{service:'Descripción de servicio extensa. '.repeat(30),quantity:2,price:100000}]},{name:'Cliente'},{editable:true})).bytes);
 expect(pdf.getPageCount()).toBeGreaterThan(12);const fields=pdf.getForm().getFields().filter(f=>f.getName().startsWith('anexo_')).map(f=>f.getText()).join('\n');expect(fields).toContain('Nota importante');expect(fields.replace(/\s+/g,' ').trim()).toContain(text.replace(/\s+/g,' ').trim());expect(fields).toContain('Descripción de servicio extensa.');
});
test('branding: portada sin cliente y valor editable en Coolvetica Regular con tracking -40',async()=>{
 const q={...base,type:'Branding',terms:brandTerms,items:[{service:'Identidad visual',quantity:1,price:1234567890.75}]};
 const pdf=await PDFDocument.load((await quotePDF(q,{name:'Cliente que no se imprime'},{editable:true})).bytes),form=pdf.getForm();
 expect(pdf.getPageCount()).toBe(12);expect(form.getFields().map(f=>f.getName())).not.toContain('cliente');
 const total=form.getTextField('total'),da=total.acroField.getDefaultAppearance();
 expect(total.getText()).toBe('$ 1.234.567.890,75');expect(da).toMatch(/^\/Coolvetica-Regular /);
 const size=Number(da.match(/([\d.]+) Tf/)[1]);expect(da).toContain(`${size*-.04} Tc`);
 const resources=form.acroForm.dict.lookup(PDFName.of('DR'),PDFDict).lookup(PDFName.of('Font'),PDFDict);
 expect(resources.has(PDFName.of('Coolvetica-Regular'))).toBe(true);expect(resources.has(PDFName.of('Poppins-Regular'))).toBe(true);
 const widget=total.acroField.getWidgets()[0],ap=Buffer.from(decodePDFRawStream(widget.getAppearances().normal).decode()).toString(),matrix=ap.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/);
 expect(ap).toContain(`${size*-.04} Tc`);expect(ap).toContain('/Coolvetica-Regular ');
 expect(pdf.getPage(8).getHeight()-widget.getRectangle().y-Number(matrix[2])).toBeCloseTo(548.1754,4);
 total.setText('$ 9.876.543.210,50');const edited=await PDFDocument.load(await pdf.save({updateFieldAppearances:false}));expect(edited.getForm().getTextField('total').getText()).toBe('$ 9.876.543.210,50');
});
