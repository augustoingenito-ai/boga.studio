import {test,expect} from '@playwright/test';
import {PDFDocument,PDFArray,decodePDFRawStream} from 'pdf-lib';
import {readFile} from 'node:fs/promises';
import {quotePDF} from '../quote-pdf.js';
import {monthlyType} from '../public/quote-totals.js';

const appearance=f=>Buffer.from(decodePDFRawStream(f.acroField.getWidgets()[0].getAppearances().normal).decode()).toString();
const pageContent=pdf=>{const c=pdf.getPage(0).node.Contents();return (c instanceof PDFArray?c.asArray():[c]).map(ref=>Buffer.from(decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString()).join('\n');};

test('acompañamiento mensual: importe directo, guardado, edición y descarga desde el CRM',async({page,request})=>{
 const c=await (await request.post('/api/clients',{data:{name:'Cliente Mensual',company:'Marca Norte'}})).json();
 await page.goto('/');await page.getByRole('button',{name:'Presupuestos',exact:true}).click();await page.getByRole('button',{name:'+ Nuevo presupuesto'}).click();
 await page.getByLabel('Cliente',{exact:true}).selectOption(c.id);await page.getByLabel('Plantilla').selectOption(monthlyType);
 await expect(page.locator('#collection-settings')).toBeHidden();await expect(page.locator('#branding-timeline')).toBeHidden();await expect(page.locator('#collection-intake')).toHaveCount(0);
 await expect(page.getByLabel('Servicio',{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'+ Agregar servicio'})).toBeHidden();await expect(page.getByLabel('Validez en PDF')).toBeHidden();
 await page.getByLabel('Importe mensual (ARS)').fill('590000.75');await expect(page.locator('#quote-total')).toContainText('590.000,75');
 await page.getByLabel('Plantilla').selectOption('Diseño');await expect(page.getByLabel('Servicio',{exact:true})).toBeEnabled();await expect(page.getByLabel('Importe mensual (ARS)')).toBeHidden();
 await page.getByLabel('Plantilla').selectOption(monthlyType);await page.getByLabel('Referencia',{exact:true}).fill('AM-001');await page.getByLabel('Fecha',{exact:true}).fill('2026-11-10');
 await page.screenshot({path:'/tmp/boga-monthly-form.png',fullPage:true});await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 let q=(await (await request.get('/api/state')).json()).quotes.find(q=>q.number==='AM-001');expect(q).toMatchObject({type:monthlyType,total:590000.75,consultationDiscount:0,hadConsultation:false,items:[{service:monthlyType,quantity:1,price:590000.75}]});
 const row=page.getByRole('row').filter({hasText:'AM-001'});await row.getByRole('button',{name:'Editar',exact:true}).click();await expect(page.getByLabel('Importe mensual (ARS)')).toHaveValue('590000.75');
 await page.getByLabel('Importe mensual (ARS)').fill('625000');await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.locator('#modal')).not.toBeVisible();
 q=(await (await request.get('/api/state')).json()).quotes.find(q=>q.number==='AM-001');expect(q.total).toBe(625000);
 await row.getByRole('button',{name:'PDF',exact:true}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar PDF editable',exact:true}).click();const download=await downloadPromise;
 const path=await download.path(),pdf=await PDFDocument.load(await readFile(path));expect(pdf.getPageCount()).toBe(1);expect(pdf.getForm().getTextField('cliente').getText()).toBe('Cliente Mensual - Marca Norte');expect(pdf.getForm().getTextField('fecha').getText()).toBe('10/11/2026');expect(pdf.getForm().getTextField('total').getText()).toBe('625.000 ARS');
 const response=await request.get('/api/quotes/'+q.id+'/pdf?download=1');expect(response.ok()).toBeTruthy();expect(response.headers()['content-disposition']).toContain('BOGA-acompanamiento-mensual-final.pdf');
 await page.locator('#modal .modal-head button').click();await row.getByRole('button',{name:'Editar',exact:true}).click();await page.getByLabel('Importe mensual (ARS)').fill('-1');await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.locator('#modal')).toBeVisible();
});

test('PDF mensual: solo cliente, fecha y total; conserva una hoja y sus fuentes, sin datos de ejemplo',async()=>{
 const q={type:monthlyType,date:'2026-11-10',number:'REF interna',items:[{service:'Servicio interno',quantity:1,price:1234567.89}],hadConsultation:true,consultationAmount:40000,validityText:'No imprimir',terms:'No imprimir',description:'No imprimir',schedule:'No imprimir',timeline:['No imprimir']};
 const base=await PDFDocument.load(await readFile(new URL('../templates/monthly-base.pdf',import.meta.url)));
 for(const editable of [false,true]){
  const pdf=await PDFDocument.load((await quotePDF(q,{name:'María Núñez',company:'Árbol Textil'},{editable})).bytes),form=pdf.getForm();
  expect(pdf.getPageCount()).toBe(1);expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.276);expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89);
  const content=pageContent(pdf);expect(content).not.toContain('Laura');expect(content).not.toContain('590.000');
  if(editable){
   expect(form.getFields().map(f=>f.getName()).sort()).toEqual(['cliente','fecha','total']);expect(content).toContain(pageContent(base));expect(content.replace(pageContent(base),'').replace(/\s/g,'')).toBe('qQ');
   for(const [name,value,font,size,baseline] of [['cliente','María Núñez - Árbol Textil','SortsMillGoudy-Regular',18.5438,70.2914],['fecha','10/11/2026','SortsMillGoudy-Regular',18.5438,92.544],['total','1.234.567,89 ARS','Poppins-Regular',18,607.5404]]){
    const f=form.getTextField(name),widget=f.acroField.getWidgets()[0],ap=appearance(f),matrix=ap.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/);
    expect(f.getText()).toBe(value);expect(f.acroField.getDefaultAppearance()).toContain('/'+font+' '+size+' Tf');expect(ap).toContain(`${size*-.04} Tc`);expect(pdf.getPage(0).getHeight()-widget.getRectangle().y-Number(matrix[2])).toBeCloseTo(baseline,4);
   }
   const total=form.getTextField('total');expect(appearance(total)).toContain('0 0 0 rg');expect(appearance(total)).toContain('0.25 w');expect(appearance(total)).toContain('2 Tr');expect(total.acroField.getWidgets()[0].getRectangle().x+total.acroField.getWidgets()[0].getRectangle().width).toBeCloseTo(538.0423,4);
   form.getTextField('cliente').setText('Otro nombre editable');const edited=await PDFDocument.load(await pdf.save({updateFieldAppearances:false}));expect(edited.getForm().getTextField('cliente').getText()).toBe('Otro nombre editable');
  }else{expect(form.getFields()).toHaveLength(0);for(const ref of pdf.getPage(0).node.Annots()?.asArray()||[])expect(pdf.context.lookup(ref)).toBeDefined();}
 }
 const noCompany=await PDFDocument.load((await quotePDF(q,{name:'Cliente sin marca'},{editable:true})).bytes);expect(noCompany.getForm().getTextField('cliente').getText()).toBe('Cliente sin marca');
 await expect(quotePDF(q,{name:'Cliente con nombre demasiado extenso '.repeat(15)})).rejects.toMatchObject({status:422});
});
