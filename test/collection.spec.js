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
 await page.getByLabel('Tipologías de la colección').fill('8');await page.getByLabel('Referencia',{exact:true}).fill('CO-001');await page.getByText('Cronograma de colección',{exact:true}).click();await page.getByLabel('Investigación',{exact:true}).fill('2 días');await page.getByLabel('Revisión final',{exact:true}).fill('1 día');
 for(let i=0;i<items.length;i++){if(i)await page.getByRole('button',{name:'+ Agregar servicio'}).click();await page.getByLabel('Servicio',{exact:true}).nth(i).fill(items[i].service);await page.getByLabel('Cantidad',{exact:true}).nth(i).fill(String(items[i].quantity));await page.getByLabel('Precio unitario',{exact:true}).nth(i).fill(String(items[i].price));}
 await expect(page.locator('#quote-total')).toContainText('1.200.000');await page.locator('#quote-total').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/boga-collection-form.png',fullPage:true});await expect(page.locator('#quote-breakdown')).toContainText('1.350.000');
 await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 let q=(await (await request.get('/api/state')).json()).quotes.find(q=>q.number==='CO-001');expect(q).toMatchObject({type:collectionType,subtotal:1350000,consultationDiscount:150000,total:1200000,hadConsultation:true,collectionTypologies:8});expect(q.items).toHaveLength(4);
 const row=page.getByRole('row').filter({hasText:'CO-001'});await row.getByRole('button',{name:'Editar',exact:true}).click();await expect(page.locator('#collection-intake')).toHaveCount(0);await expect(page.getByLabel('Importe cobrado por asesoría (ARS)')).toHaveValue('150000');await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();q=(await (await request.get('/api/state')).json()).quotes.find(item=>item.number==='CO-001');expect(q.total).toBe(1200000);
 await row.getByRole('button',{name:'PDF',exact:true}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar PDF editable',exact:true}).click();const file=await downloadPromise;await file.saveAs('/tmp/boga-collection-ui.pdf');const pdf=await PDFDocument.load(await readFile('/tmp/boga-collection-ui.pdf'));expect(pdf.getPageCount()).toBe(10);expect(pdf.getForm().getTextField('cliente').getText()).toBe('Cliente Colección');expect(pdf.getForm().getTextField('total').getText()).toBe('1.200.000');expect(pdf.getForm().getTextField('descuento_asesoria').getText()).toBe('150.000');expect(pdf.getForm().getTextField('investigacion').getText()).toBe('2 días');expect(pdf.getForm().getTextField('revision_final').getText()).toBe('1 día');for(const name of ['tipologias','servicios_y_notas','referencia'])expect(pdf.getForm().getFields().map(f=>f.getName())).not.toContain(name);
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
const pageContent=(pdf,index)=>pdf.getPage(index).node.Contents().asArray().map(ref=>Buffer.from(decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString()).join('\n');
const cream='0.043 0.035 0.102 0 k',green='0.737 0 0.773 0 k';
test('colección nueva: diez páginas, datos en portada, importes Coolvetica en página 8 y contenido fijo',async()=>{
 const q={type:collectionType,date:'2026-11-10',validityText:'30 días',items:[{service:'Servicio interno',quantity:8,price:45000}],hadConsultation:true,consultationAmount:40000,collectionTypologies:8,terms:'Condiciones internas',description:'Nota interna',schedule:'Adicional interno',timeline:['2 días','5 días','2 días','3 días','1 día']};
 const pdf=await PDFDocument.load((await quotePDF(q,{name:'María Núñez'},{editable:true})).bytes),form=pdf.getForm();
 expect(pdf.getPageCount()).toBe(10);expect(pdf.getPage(0).getWidth()).toBeCloseTo(841.89,2);expect(pdf.getPage(0).getHeight()).toBeCloseTo(595.276,2);
 for(const f of form.getFields()){const da=f.acroField.getDefaultAppearance(),size=Number(da.match(/([\d.]+) Tf/)[1]);expect(da).toContain(`${size*-.04} Tc`);expect(appearance(f)).toContain(`${size*-.04} Tc`);}
 for(const [name,value] of [['cliente','María Núñez'],['fecha','Fecha: 10/11/2026'],['validez','Validez: 30 días']]){const f=form.getTextField(name);expect(f.getText()).toBe(value);expect(f.acroField.getWidgets()[0].P().toString()).toBe(pdf.getPage(0).ref.toString());}
 for(const [name,value,baseline,color] of [['subtotal','360.000',470.8502,cream],['descuento_asesoria','40.000',509.3014,cream],['total','320.000',549.0889,green]]){
  const f=form.getTextField(name),widget=f.acroField.getWidgets()[0],ap=appearance(f),matrix=ap.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/);
  expect(f.getText()).toBe(value);expect(f.acroField.getDefaultAppearance()).toContain('/Coolvetica-Regular');expect(ap).toContain(color);expect(widget.P().toString()).toBe(pdf.getPage(7).ref.toString());
  expect(pdf.getPage(7).getHeight()-widget.getRectangle().y-Number(matrix[2])).toBeCloseTo(baseline,4);expect(widget.getRectangle().x+widget.getRectangle().width).toBe(749);
 }
 expect(form.getTextField('diseno').getText()).toBe('5 días');expect(form.getTextField('revision_final').getText()).toBe('1 día');
 for(const name of ['tipologias','servicios','servicios_y_notas','notas','condiciones_particulares','referencia'])expect(form.getFields().map(f=>f.getName())).not.toContain(name);
 const content=pageContent(pdf,7);expect(content).not.toContain('[(350)31');expect(content).not.toContain('[(40)31');expect(content).not.toContain('[(3)10 (10)31');
 form.getTextField('total').setText('999.999');const edited=await PDFDocument.load(await pdf.save({updateFieldAppearances:false}));expect(edited.getForm().getTextField('total').getText()).toBe('999.999');
 const final=await PDFDocument.load((await quotePDF(q,{name:'María Núñez'})).bytes);expect(final.getPageCount()).toBe(10);expect(final.getForm().getFields()).toHaveLength(0);
});
test('colección sin asesoría: solo total verde en página 8, sin ejemplos ni anexos',async()=>{
 const q={type:collectionType,items:[{service:'Diseño de Colección',quantity:8,price:45000}],hadConsultation:false,consultationAmount:40000,collectionTypologies:8};
 for(const terms of [collectionTerms,'Condición interna personalizada'])for(const editable of [false,true]){
  const result=await quotePDF({...q,terms,description:'No imprimir esta nota',schedule:'No imprimir este adicional'},{name:'Cliente'},{editable}),pdf=await PDFDocument.load(result.bytes),form=pdf.getForm();
  expect(pdf.getPageCount()).toBe(10);
  const content=pageContent(pdf,7);expect(content).not.toContain('[(DES)8');expect(content).not.toContain('[(SUB)23');expect(content).toContain('[(T)-142');
  const names=form.getFields().map(f=>f.getName());for(const name of ['descuento_asesoria','subtotal','notas','condiciones_particulares'])expect(names).not.toContain(name);
  if(editable){
   const total=form.getTextField('total'),widget=total.acroField.getWidgets()[0],ap=appearance(total),matrix=ap.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/);
   expect(total.getText()).toBe('360.000');expect(total.acroField.getDefaultAppearance()).toContain('/Coolvetica-Regular');expect(ap).toContain(green);expect(widget.P().toString()).toBe(pdf.getPage(7).ref.toString());
   expect(pdf.getPage(7).getHeight()-widget.getRectangle().y-Number(matrix[2])).toBeCloseTo(549.0889,4);
  }else expect(form.getFields()).toHaveLength(0);
 }
});
