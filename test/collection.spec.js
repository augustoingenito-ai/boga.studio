import {test,expect} from '@playwright/test';
import {PDFDocument,decodePDFRawStream} from 'pdf-lib';
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
 await page.getByLabel('Tipologías de la colección').fill('8');await page.getByLabel('Referencia',{exact:true}).fill('CO-001');
 for(let i=0;i<items.length;i++){if(i)await page.getByRole('button',{name:'+ Agregar servicio'}).click();await page.getByLabel('Servicio',{exact:true}).nth(i).fill(items[i].service);await page.getByLabel('Cantidad',{exact:true}).nth(i).fill(String(items[i].quantity));await page.getByLabel('Precio unitario',{exact:true}).nth(i).fill(String(items[i].price));}
 await expect(page.locator('#quote-total')).toContainText('1.200.000');await page.locator('#quote-total').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/boga-collection-form.png',fullPage:true});await expect(page.locator('#quote-breakdown')).toContainText('1.350.000');
 await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 let q=(await (await request.get('/api/state')).json()).quotes.find(q=>q.number==='CO-001');expect(q).toMatchObject({type:collectionType,subtotal:1350000,consultationDiscount:150000,total:1200000,hadConsultation:true,collectionTypologies:8});expect(q.items).toHaveLength(4);
 const row=page.getByRole('row').filter({hasText:'CO-001'});await row.getByRole('button',{name:'Editar',exact:true}).click();await expect(page.locator('#collection-intake')).toHaveCount(0);await expect(page.getByLabel('Importe cobrado por asesoría (ARS)')).toHaveValue('150000');await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();q=(await (await request.get('/api/state')).json()).quotes.find(item=>item.number==='CO-001');expect(q.total).toBe(1200000);
 await row.getByRole('button',{name:'PDF',exact:true}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar PDF editable',exact:true}).click();const file=await downloadPromise;await file.saveAs('/tmp/boga-collection-ui.pdf');const pdf=await PDFDocument.load(await readFile('/tmp/boga-collection-ui.pdf'));expect(pdf.getPageCount()).toBe(1);expect(pdf.getForm().getTextField('tipologias').getText()).toBe('8');expect(pdf.getForm().getTextField('total').getText()).toBe('$ 1.200.000');expect(pdf.getForm().getTextField('descuento_asesoria').getText()).toBe('-$ 150.000');expect(pdf.getForm().getFields().map(f=>f.getName())).not.toContain('servicios_y_notas');
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
test('colección: datos con tracking -40, importes alineados y colores solo en los números',async()=>{
 const q={type:collectionType,items:[{service:'Diseño de Colección',quantity:8,price:45000}],hadConsultation:true,consultationAmount:40000,collectionTypologies:8,terms:collectionTerms};
 const pdf=await PDFDocument.load((await quotePDF(q,{name:'Cliente'},{editable:true})).bytes),form=pdf.getForm();
 const appearance=f=>Buffer.from(decodePDFRawStream(f.acroField.getWidgets()[0].getAppearances().normal).decode()).toString();
 for(const f of form.getFields()){
  const da=f.acroField.getDefaultAppearance(),size=Number(da.match(/([\d.]+) Tf/)[1]);
  expect(da).toContain(`${size*-.04} Tc`);expect(appearance(f)).toContain(`${size*-.04} Tc`);
 }
 for(const [name,baseline,color] of [['subtotal',610.9154,'0 0 0 rg'],['descuento_asesoria',636.3998,'0.8274509803921568 0.1843137254901961 0.1843137254901961 rg'],['total',663.8841,'0.023529411764705882 0.6980392156862745 0.42745098039215684 rg']]){
  const f=form.getTextField(name),widget=f.acroField.getWidgets()[0],ap=appearance(f),matrix=ap.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/);
  expect(f.acroField.getDefaultAppearance()).toContain(color);expect(ap).toContain(color);
  expect(pdf.getPage(0).getHeight()-widget.getRectangle().y-Number(matrix[2])).toBeCloseTo(baseline,4);
  expect(widget.getRectangle().x+widget.getRectangle().width).toBe(542);
 }
 expect(form.getFields().map(f=>f.getName())).not.toContain('servicios_y_notas');
 const noted=await PDFDocument.load((await quotePDF({...q,description:'Nota del cliente'},{name:'Cliente'},{editable:true})).bytes);
 expect(noted.getForm().getTextField('notas').getText()).toBe('Nota del cliente');
});
test('colección sin asesoría: PDF final y editable omiten el descuento y compactan el total',async()=>{
 const q={type:collectionType,items:[{service:'Diseño de Colección',quantity:8,price:45000}],hadConsultation:false,consultationAmount:40000,collectionTypologies:8};
 for(const terms of [collectionTerms,'Condición particular: 50% al iniciar y 50% al entregar.'])for(const editable of [false,true]){
  const result=await quotePDF({...q,terms},{name:'Cliente'},{editable}),pdf=await PDFDocument.load(result.bytes),page=pdf.getPage(0),form=pdf.getForm();
  expect(pdf.getPageCount()).toBe(1);
  const content=page.node.Contents().asArray().map(ref=>Buffer.from(decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString()).join('\n');
  expect(content).not.toContain('DESCUENTO POR ASESOR');expect(content).not.toContain('(SUBTOTAL)');expect(content).toContain('(TOTAL)');
  expect(form.getFields().map(f=>f.getName())).not.toContain('descuento_asesoria');
  if(editable){
   expect(form.getFields().map(f=>f.getName())).not.toContain('subtotal');expect(form.getTextField('total').getText()).toBe('$ 360.000');
   const total=form.getTextField('total'),widget=total.acroField.getWidgets()[0],ap=Buffer.from(decodePDFRawStream(widget.getAppearances().normal).decode()).toString(),matrix=ap.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/);
   expect(page.getHeight()-widget.getRectangle().y-Number(matrix[2])).toBeCloseTo(610.9154,4);expect(widget.getRectangle().x+widget.getRectangle().width).toBe(542);
   if(terms!==collectionTerms)expect(form.getTextField('condiciones_particulares').getText()).toBe(terms);
  }else expect(form.getFields()).toHaveLength(0);
 }
});
