import {test,expect} from '@playwright/test';
import {PDFDocument,PDFArray,decodePDFRawStream} from 'pdf-lib';
import {readFile} from 'node:fs/promises';
import {quoteTotals,collectionType} from '../public/quote-totals.js';
import {quotePDF} from '../quote-pdf.js';
import {collectionTerms,designTerms} from '../public/quote-defaults.js';
const items=[{service:'Diseño de colección',quantity:1,price:500000},{service:'Seguimiento de producción',quantity:1,price:750000},{service:'Fichas técnicas',quantity:3,price:40000},{service:'Bonificación',quantity:1,price:-20000}];
test('colección: pregunta previa, tipologías, importe negativo y descuento aplicado una vez',async({page,request})=>{
 const c=await (await request.post('/api/clients',{data:{name:'Cliente Colección'}})).json();
 await page.goto('/');await page.getByRole('button',{name:'Presupuestos',exact:true}).click();await page.getByRole('button',{name:'+ Nuevo presupuesto'}).click();await page.getByLabel('Cliente',{exact:true}).selectOption(c.id);
 await page.getByLabel('Plantilla').selectOption(collectionType);await expect(page.getByRole('heading',{name:'Antes de armar la colección'})).toBeVisible();await page.screenshot({path:'/tmp/boga-collection-intake.png',fullPage:true});
 await page.getByLabel('¿El cliente tuvo asesoría previa?').selectOption('yes');await page.getByLabel('¿Cuánto le cobraste? (ARS)').fill('150000');await page.getByRole('button',{name:'Continuar con el presupuesto'}).click();
 await page.getByLabel('Tipologías de la colección').fill('8');await page.getByLabel('Referencia',{exact:true}).fill('CO-001');await expect(page.locator('#branding-timeline')).toBeHidden();
 for(let i=0;i<items.length;i++){if(i)await page.getByRole('button',{name:'+ Agregar servicio'}).click();await page.getByLabel('Servicio',{exact:true}).nth(i).fill(items[i].service);await page.getByLabel('Cantidad',{exact:true}).nth(i).fill(String(items[i].quantity));await page.getByLabel('Precio unitario',{exact:true}).nth(i).fill(String(items[i].price));}
 await expect(page.locator('#quote-total')).toContainText('1.200.000');await page.locator('#quote-total').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/boga-collection-form.png',fullPage:true});await expect(page.locator('#quote-breakdown')).toContainText('1.350.000');
 await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 let q=(await (await request.get('/api/state')).json()).quotes.find(q=>q.number==='CO-001');expect(q).toMatchObject({type:collectionType,subtotal:1350000,consultationDiscount:150000,total:1200000,hadConsultation:true,collectionTypologies:8});expect(q.items).toHaveLength(4);
 const row=page.getByRole('row').filter({hasText:'CO-001'});await row.getByRole('button',{name:'Editar',exact:true}).click();await expect(page.locator('#collection-intake')).toHaveCount(0);await expect(page.getByLabel('Importe cobrado por asesoría (ARS)')).toHaveValue('150000');await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();q=(await (await request.get('/api/state')).json()).quotes.find(item=>item.number==='CO-001');expect(q.total).toBe(1200000);
 await row.getByRole('button',{name:'PDF',exact:true}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar PDF editable',exact:true}).click();const file=await downloadPromise;await file.saveAs('/tmp/boga-collection-ui.pdf');const pdf=await PDFDocument.load(await readFile('/tmp/boga-collection-ui.pdf'));expect(pdf.getPageCount()).toBe(12);expect(pdf.getForm().getTextField('cliente').getText()).toBe('Cliente Colección');expect(pdf.getForm().getTextField('total').getText()).toBe('1.200.000 ARS');expect(pdf.getForm().getTextField('descuento_asesoria').getText()).toBe('- 150.000 ARS');expect(pdf.getForm().getTextField('tipologias').getText()).toBe('8');for(const name of ['investigacion','revision_final','servicios_y_notas','referencia'])expect(pdf.getForm().getFields().map(f=>f.getName())).not.toContain(name);
});
test('cancelar la pregunta vuelve a diseño y una colección sin asesoría no pide importe',async({page,request})=>{
 await request.post('/api/clients',{data:{name:'Sin asesoría'}});await page.goto('/');await page.getByRole('button',{name:'Presupuestos',exact:true}).click();await page.getByRole('button',{name:'+ Nuevo presupuesto'}).click();await page.getByLabel('Plantilla').selectOption(collectionType);await page.locator('#collection-intake').getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.getByLabel('Plantilla')).toHaveValue('Diseño');await page.getByLabel('Plantilla').selectOption(collectionType);await page.getByLabel('¿El cliente tuvo asesoría previa?').selectOption('no');await expect(page.getByLabel('¿Cuánto le cobraste? (ARS)')).not.toBeVisible();await page.getByRole('button',{name:'Continuar con el presupuesto'}).click();await expect(page.getByLabel('Importe cobrado por asesoría (ARS)')).toBeDisabled();await expect(page.getByLabel('Importe cobrado por asesoría (ARS)')).toHaveValue('0');
});
test('servidor: importes firmados, validación de asesoría y total neto usado para los cobros',async({request})=>{
 const c=await (await request.post('/api/clients',{data:{name:'Validación Colección'}})).json();const base={clientId:c.id,type:collectionType,items,status:'Borrador',paid:0,hadConsultation:true,consultationAmount:150000,collectionTypologies:8,total:1};
 const created=await request.post('/api/quotes',{data:base});expect(created.status()).toBe(201);const q=await created.json();expect(q.total).toBe(1200000);expect(q.subtotal).toBe(1350000);
 const update=await (await request.put('/api/quotes/'+q.id,{data:base})).json();expect(update.total).toBe(1200000);
 expect((await request.post('/api/quotes',{data:{...base,hadConsultation:null}})).status()).toBe(400);expect((await request.post('/api/quotes',{data:{...base,collectionTypologies:0}})).status()).toBe(400);expect((await request.post('/api/quotes',{data:{...base,consultationAmount:2000000}})).status()).toBe(400);expect((await request.post('/api/quotes',{data:{...base,paid:1250000}})).status()).toBe(400);
 const no=await (await request.post('/api/quotes',{data:{...base,hadConsultation:false,consultationAmount:150000}})).json();expect(no.total).toBe(1350000);expect(no.consultationDiscount).toBe(0);
});
test('centavos y PDF de diseño de 3 a 6 servicios mantienen una sola hoja',async()=>{
 expect(quoteTotals({type:collectionType,items:[{quantity:3,price:.1},{quantity:1,price:-.05}],hadConsultation:true,consultationAmount:.1})).toEqual({subtotal:.25,consultationDiscount:.1,total:.15});
 for(const count of [3,4,5,6]){const q={type:'Diseño',items:Array.from({length:count},(_,i)=>({service:'Servicio '+i,quantity:1,price:i===count-1?-100:10000})),terms:designTerms};const pdf=await PDFDocument.load((await quotePDF(q,{name:'Cliente'},{editable:true})).bytes);expect(pdf.getPageCount()).toBe(1);expect(pdf.getForm().getTextField('servicio_'+count).getText()).toBe('Servicio '+(count-1));}
});
const appearance=f=>Buffer.from(decodePDFRawStream(f.acroField.getWidgets()[0].getAppearances().normal).decode()).toString();
const pageContent=(pdf,index)=>{const contents=pdf.getPage(index).node.Contents();return (contents instanceof PDFArray?contents.asArray():[contents]).map(ref=>Buffer.from(decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString()).join('\n');};
const green='0.22 0.675 0.384 rg';
test('colección nueva: doce páginas, datos solo en 1, 9 y 10 y tipografías del original',async()=>{
 const q={type:collectionType,date:'2026-11-10',validityText:'30 días',items:[{service:'Servicio interno',quantity:8,price:45000}],hadConsultation:true,consultationAmount:40000,collectionTypologies:8,terms:'Condiciones internas',description:'Nota interna',schedule:'Adicional interno',timeline:['No imprimir investigación','No imprimir diseño','No imprimir devolución','No imprimir entrega','No imprimir revisión']};
 const pdf=await PDFDocument.load((await quotePDF(q,{name:'María Núñez'},{editable:true})).bytes),form=pdf.getForm();
 expect(pdf.getPageCount()).toBe(12);expect(pdf.getPage(0).getWidth()).toBeCloseTo(841.89,2);expect(pdf.getPage(0).getHeight()).toBeCloseTo(595.276,2);
 const dataPages=[0,8,9].map(i=>pdf.getPage(i).ref.toString());
 for(const f of form.getFields()){
  const da=f.acroField.getDefaultAppearance(),size=Number(da.match(/([\d.]+) Tf/)[1]);expect(da).toContain(`${size*-.04} Tc`);expect(appearance(f)).toContain(`${size*-.04} Tc`);
  expect(dataPages).toContain(f.acroField.getWidgets()[0].P().toString());
 }
 for(const [name,value] of [['cliente','María Núñez'],['fecha','10/11/2026'],['validez','30 días']]){const f=form.getTextField(name);expect(f.getText()).toBe(value);expect(f.acroField.getDefaultAppearance()).toContain('/Poppins-Regular 22.1782 Tf');expect(appearance(f)).toContain(green);expect(f.acroField.getWidgets()[0].P().toString()).toBe(pdf.getPage(0).ref.toString());}
 const typologies=form.getTextField('tipologias');expect(typologies.getText()).toBe('8');expect(typologies.acroField.getDefaultAppearance()).toContain('/Coolvetica-Regular 22.0132 Tf');expect(typologies.acroField.getWidgets()[0].P().toString()).toBe(pdf.getPage(8).ref.toString());
 for(const [name,value,baseline,color] of [['subtotal','360.000 ARS',467.11,'0 0 0 rg'],['descuento_asesoria','- 40.000 ARS',499.7809,'0.89 0.145 0.18 rg'],['total','320.000 ARS',535.0045,green]]){
  const f=form.getTextField(name),widget=f.acroField.getWidgets()[0],ap=appearance(f),matrix=ap.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/);
  expect(f.getText()).toBe(value);expect(f.acroField.getDefaultAppearance()).toContain('/Poppins-Regular 23.07 Tf');expect(ap).toContain(color);expect(ap).toContain('2 Tr');expect(ap).toContain('0.32 w');expect(widget.P().toString()).toBe(pdf.getPage(9).ref.toString());
  expect(pdf.getPage(9).getHeight()-widget.getRectangle().y-Number(matrix[2])).toBeCloseTo(baseline,4);expect(widget.getRectangle().x+widget.getRectangle().width).toBe(776);
 }
 for(const name of ['investigacion','diseno','revision_final','servicios','servicios_y_notas','notas','condiciones_particulares','referencia'])expect(form.getFields().map(f=>f.getName())).not.toContain(name);
 const original=await PDFDocument.load(await readFile(new URL('../templates/collection.pdf',import.meta.url)));
 for(const i of [1,2,3,4,5,6,7,10,11])expect(pageContent(pdf,i)).toBe(pageContent(original,i));
 const content=pageContent(pdf,9);for(const example of ['(350.000 ARS)Tj','(40.000 ARS)Tj','(310.000 ARS)Tj','(-)Tj'])expect(content).not.toContain(example);
 form.getTextField('total').setText('999.999 ARS');const edited=await PDFDocument.load(await pdf.save({updateFieldAppearances:false}));expect(edited.getForm().getTextField('total').getText()).toBe('999.999 ARS');
 const final=await PDFDocument.load((await quotePDF(q,{name:'María Núñez'})).bytes);expect(final.getPageCount()).toBe(12);expect(final.getForm().getFields()).toHaveLength(0);
});
test('colección sin asesoría: solo total verde en página 10, sin ejemplos ni anexos',async()=>{
 const q={type:collectionType,items:[{service:'Diseño de Colección',quantity:8,price:45000}],hadConsultation:false,consultationAmount:40000,collectionTypologies:8};
 for(const terms of [collectionTerms,'Condición interna personalizada'])for(const editable of [false,true]){
  const result=await quotePDF({...q,terms,description:'No imprimir esta nota',schedule:'No imprimir este adicional'},{name:'Cliente'},{editable}),pdf=await PDFDocument.load(result.bytes),form=pdf.getForm();
  expect(pdf.getPageCount()).toBe(12);
  const content=pageContent(pdf,9);expect(content).not.toContain('[(DES)8');expect(content).not.toContain('[(SUB)23');expect(content).toContain('[(T)-142');
  const names=form.getFields().map(f=>f.getName());for(const name of ['descuento_asesoria','subtotal','notas','condiciones_particulares'])expect(names).not.toContain(name);
  if(editable){
   const total=form.getTextField('total'),widget=total.acroField.getWidgets()[0],ap=appearance(total),matrix=ap.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/);
   expect(total.getText()).toBe('360.000 ARS');expect(total.acroField.getDefaultAppearance()).toContain('/Poppins-Regular');expect(ap).toContain(green);expect(widget.P().toString()).toBe(pdf.getPage(9).ref.toString());
   expect(pdf.getPage(9).getHeight()-widget.getRectangle().y-Number(matrix[2])).toBeCloseTo(467.11,4);
  }else expect(form.getFields()).toHaveLength(0);
 }
});
test('la cantidad manual reemplaza el ejemplo y desplaza la frase sin superponerse',async()=>{
 let previousX=0;
 for(const count of [1,12,9999]){
  const q={type:collectionType,items:[{quantity:1,price:100000}],hadConsultation:false,collectionTypologies:count};
  const pdf=await PDFDocument.load((await quotePDF(q,{name:'Cliente'},{editable:true})).bytes);
  expect(pdf.getForm().getTextField('tipologias').getText()).toBe(String(count));
  const content=pageContent(pdf,8);expect(content).not.toContain('al de 6');
  const x=Number([...content.matchAll(/22.0132 0 0 22.0132 ([\d.]+) 381.3359 Tm/g)].at(-1)[1]);expect(x).toBeGreaterThan(previousX);expect(x).toBeLessThan(305);previousX=x;
 }
});
