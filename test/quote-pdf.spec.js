import {test,expect} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';
import {quotePDF} from '../quote-pdf.js';
import {designTerms,brandTerms} from '../public/quote-defaults.js';
const base={title:'Identidad Álamo',number:'BG-TEST',date:'2026-11-03',validUntil:'2026-12-03',items:[{service:'Diseño gráfico',quantity:2,price:100000}],total:200000};
test('plantillas originales: tamaños, doce páginas branding y PDF rellenable con valores reales',async()=>{
 for(const [type,pages,terms] of [['Diseño',1,designTerms],['Branding',12,brandTerms]]){
  const result=await quotePDF({...base,type,terms,timeline:['2 días','5 días','2 días','3 días','1 día']},{name:'María Núñez'},{editable:true});const pdf=await PDFDocument.load(result.bytes);expect(pdf.getPageCount()).toBe(pages);expect(pdf.getPage(0).getWidth()>pdf.getPage(0).getHeight()).toBe(type==='Branding');
  const form=pdf.getForm();expect(form.getFields().map(f=>f.getName())).not.toContain('proyecto');expect(pdf.getTitle()).not.toContain(base.title);expect(form.getTextField('cliente').getText()).toBe('María Núñez');expect(form.getTextField('total').getText()).toBe('$ 200.000');
  if(type==='Branding')expect(form.getTextField('investigacion').getText()).toBe('2 días');
  form.getTextField('cliente').setText('Nombre editado');const edited=await PDFDocument.load(await pdf.save({updateFieldAppearances:false}));expect(edited.getForm().getTextField('cliente').getText()).toBe('Nombre editado');
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
