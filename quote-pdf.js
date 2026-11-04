import { PDFDocument, PDFName, TextAlignment, layoutMultilineText, layoutSinglelineText, drawTextField, setCharacterSpacing, setFillingColor, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'node:fs';
import { designTerms, brandTerms, collectionTerms } from './public/quote-defaults.js';
import {quoteTotals,collectionType} from './public/quote-totals.js';
const original={Diseño:readFileSync(new URL('./templates/design.pdf',import.meta.url)),Branding:readFileSync(new URL('./templates/branding.pdf',import.meta.url)),[collectionType]:readFileSync(new URL('./templates/collection.pdf',import.meta.url))};
const variants=Object.fromEntries(['design-grid','design-terms','design-grid-terms','collection-base','collection-terms','collection-no-consultation-base','collection-no-consultation-terms'].map(name=>[name,readFileSync(new URL('./templates/'+name+'.pdf',import.meta.url))]));
const fontBytes=readFileSync(new URL('./templates/Poppins-Regular.ttf',import.meta.url));
const coolveticaBytes=readFileSync(new URL('./templates/Coolvetica-Regular.otf',import.meta.url));
const ink=rgb(35/255,31/255,32/255),white=rgb(246/255,243/255,233/255),green=rgb(56/255,172/255,98/255),pink=rgb(241/255,200/255,216/255);
const cash=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0,maximumFractionDigits:2}).format(n||0).replace(/\u00a0/g,' ');
const clean=v=>String(v??'').replace(/\r\n/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
const date=v=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v.split('-').reverse().join('/'):clean(v);
// Illustrator tracking -40 = -40/1000 em, scaled with each field's font size.
const tracking=-40/1000;
export async function quotePDF(q,client,{editable=false}={}){
 if(!original[q.type])throw Object.assign(new Error('Seleccioná una plantilla de presupuesto válida.'),{status:400});
 q={...q,...quoteTotals(q)};
 const singlePage=q.type!=='Branding';
 const expectedTerms=q.type==='Branding'?brandTerms:q.type===collectionType?collectionTerms:designTerms;
 const customTerms=!!(q.terms&&q.terms!==expectedTerms),compactNotes=!!(q.schedule||q.description);
 let source=original[q.type];
 if(q.type==='Diseño'){const grid=q.items.length>2,terms=customTerms||compactNotes;if(grid||terms)source=variants['design'+(grid?'-grid':'')+(terms?'-terms':'')];}
 if(q.type===collectionType)source=variants['collection'+(q.hadConsultation===true?'':'-no-consultation')+(customTerms?'-terms':'-base')];
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const template=await PDFDocument.load(source);
 const copies=1;
 for(let i=0;i<copies;i++)for(const page of await pdf.copyPages(template,template.getPageIndices()))pdf.addPage(page);
 const font=await pdf.embedFont(fontBytes,{subset:false});
 const coolvetica=q.type==='Branding'?await pdf.embedFont(coolveticaBytes,{subset:false}):undefined;
 const form=pdf.getForm(),fields=new Map(),styles=new Map(),annex=[];
 const trackedFonts=new Map();
 function withTracking(typeface){
  if(!trackedFonts.has(typeface)){
   const tracked=Object.create(typeface);
   tracked.widthOfTextAtSize=(text,size)=>typeface.widthOfTextAtSize(text,size)+Math.max(0,typeface.encodeText(text).asBytes().length/2-1)*tracking*size;
   trackedFonts.set(typeface,tracked);
  }
  return trackedFonts.get(typeface);
 }
 // Readers need the full font in AcroForm resources to edit names and prices later.
 form.acroForm.dict.set(PDFName.of('DR'),pdf.context.obj({Font:Object.fromEntries([font,coolvetica].filter(Boolean).map(f=>[f.name,f.ref]))}));
 const charsets=new Map([font,coolvetica].filter(Boolean).map(f=>[f,new Set(f.getCharacterSet())]));
 const validateText=(text,typeface=font)=>{for(const char of text)if(char!=='\n'&&!charsets.get(typeface).has(char.codePointAt(0)))throw Object.assign(new Error(`El presupuesto contiene caracteres que ${typeface===font?'Poppins':'Coolvetica'} no puede representar (por ejemplo emojis). Revisá los datos antes de descargar.`),{status:422});};
 function field(page,name,value,x,top,width,height,{size=12,min=8,color=ink,align=TextAlignment.Left,multiline=false,maxChars=0,overflowTitle='Detalle completo',baseline,typeface=font}={}){
  const trackedFont=withTracking(typeface);
  const fullText=clean(value);let text=fullText,overflowed=false;validateText(text,typeface);const overflow=()=>{if(singlePage)throw Object.assign(new Error('La información no entra en una hoja con tamaño legible. Acortá las descripciones o agrupá servicios y volvé a descargar.'),{status:422});if(!overflowed){annex.push([overflowTitle,fullText]);overflowed=true;}};
  if(maxChars&&text.length>maxChars){overflow();text=text.slice(0,maxChars-20)+'… (ver anexo)';}
  let actual=size;
  const longest=Math.max(0,...text.split('\n').map(t=>trackedFont.widthOfTextAtSize(t,actual)));
  if(!multiline&&longest>width-6){actual=Math.max(min,actual*(width-6)/longest);if(trackedFont.widthOfTextAtSize(text,actual)>width-6){overflow();while(text.length&&trackedFont.widthOfTextAtSize(text+'…',actual)>width-6)text=text.slice(0,-1);text+='…';}}
  if(multiline){const fits=()=>layoutMultilineText(text,{alignment:align,font:trackedFont,fontSize:actual,bounds:{x:1,y:1,width:width-2,height:height-2}}).lines.every(l=>l.y>=0&&l.width<=width-2);while(actual>min&&!fits())actual=Math.max(min,actual-.5);if(!fits()){overflow();while(text.length&&!fits())text=text.slice(0,-1);text=text.slice(0,-18)+'… (ver anexo)';while(text.length>18&&!fits())text=text.slice(0,-19)+'… (ver anexo)';}}
  let f=fields.get(name);if(!f){f=form.createTextField(name);if(multiline)f.enableMultiline();f.setAlignment(align);f.setText(text);f.acroField.setDefaultAppearance(`/${typeface.name} ${actual} Tf 0 g`);f.setFontSize(actual);fields.set(name,f);}
  f.addToPage(page,{x,y:page.getHeight()-top-height,width,height,font:typeface,textColor:color,backgroundColor:undefined,borderColor:undefined,borderWidth:0});
  styles.set(name,{size:actual,color,typeface,baseline:baseline===undefined?undefined:top+height-baseline});
  return f;
 }
 if(q.type==='Diseño'){
  const p=pdf.getPage(0);
  field(p,'cliente',client.name,113,44,330,28,{size:16});
  field(p,'fecha',date(q.date),113,70,310,27,{size:16});
  field(p,'validez',q.validityText||date(q.validUntil),113,95,310,27,{size:16});
  field(p,'referencia',q.number,39,746,370,19,{size:10});
  const dynamic=q.items.length>2,bodyTop=300.1,bodyBottom=dynamic?400:381.5;
  const rows=Math.max(2,q.items.length),rowHeight=(bodyBottom-bodyTop)/rows;
  if(dynamic){
   const line=(x1,y1,x2,y2)=>p.drawLine({start:{x:x1,y:p.getHeight()-y1},end:{x:x2,y:p.getHeight()-y2},thickness:1,color:rgb(0,0,0),opacity:.3});
   line(35.3,259.8,557.4,259.8);line(35.3,bodyBottom,557.4,bodyBottom);
   for(const x of [35.3,347.9,432.6,557.4])line(x,259.8,x,bodyBottom);
   line(35.3,bodyTop,557.4,bodyTop);
   for(let i=1;i<rows;i++)line(35.3,bodyTop+i*rowHeight,557.4,bodyTop+i*rowHeight);
  }
  const textSize=dynamic?Math.min(11,(rowHeight-3)/(font.heightAtSize(1)*1.2)):11;
  if(textSize<6.5)throw Object.assign(new Error('Hay demasiados servicios para una hoja legible. Agrupá algunos servicios antes de descargar.'),{status:422});
  q.items.forEach((item,index)=>{
   const top=bodyTop+index*rowHeight+1,height=rowHeight-2;
   field(p,`servicio_${index+1}`,item.service,42,top,300,height,{size:textSize,min:6.5,multiline:true,overflowTitle:`Servicio ${index+1}`});
   field(p,`cantidad_${index+1}`,String(item.quantity),352,top,75,height,{size:dynamic?textSize:13,min:6.5,align:TextAlignment.Center});
   field(p,`precio_unitario_${index+1}`,cash(item.price),437,top,115,height,{size:dynamic?textSize:12,min:6.5,align:TextAlignment.Right});
  });
  field(p,'total',cash(q.total),43,447,506,33,{size:22,align:TextAlignment.Right});
  if(customTerms||compactNotes){const parts=[q.terms||designTerms];if(q.schedule)parts.push('Cronograma y adicionales: '+q.schedule);if(q.description)parts.push('Observaciones: '+q.description);field(p,'condiciones_y_notas',parts.join('\n\n'),39,530,518,178,{size:9,min:7,multiline:true});}
 }else if(q.type===collectionType){
  const p=pdf.getPage(0);
  field(p,'cliente',client.name,99,39,320,24,{size:14});
  field(p,'fecha',date(q.date),99,61,320,23,{size:14});
  field(p,'validez',q.validityText||date(q.validUntil),99,82,320,23,{size:14});
  field(p,'tipologias',String(q.collectionTypologies||''),154,169,26,22,{size:12,min:8,align:TextAlignment.Center,baseline:185.5961});
  field(p,'subtotal',cash(q.subtotal),288,589,254,29,{size:18,color:rgb(0,0,0),align:TextAlignment.Right,baseline:610.9154});
  if(q.hadConsultation===true)field(p,'descuento_asesoria',cash(-q.consultationDiscount),288,617,254,27,{size:18,color:rgb(211/255,47/255,47/255),align:TextAlignment.Right,baseline:636.3998});
  field(p,'total',cash(q.total),288,q.hadConsultation===true?645:617,254,q.hadConsultation===true?28:27,{size:20,color:rgb(6/255,178/255,109/255),align:TextAlignment.Right,baseline:q.hadConsultation===true?663.8841:636.3998});
  field(p,'referencia',q.number,32,754,190,20,{size:9});
  if(customTerms)field(p,'condiciones_particulares',q.terms,51,702,510,22,{size:9,min:7,multiline:true});
  if(compactNotes)field(p,'notas',[q.schedule,q.description].filter(Boolean).join('\n'),49,545,500,36,{size:8,min:6.5,multiline:true});
 }else{
  const p=pdf.getPage(0);
  field(p,'fecha',q.date?'Fecha: '+date(q.date):'',48,459,240,23,{size:12,color:green});
  field(p,'validez',q.validityText?'Validez: '+q.validityText:q.validUntil?'Validez: '+date(q.validUntil):'',300,459,310,23,{size:12,color:green});
  field(p,'referencia',q.number,48,490,400,23,{size:11,color:green});
  const timeline=Array.isArray(q.timeline)?q.timeline:[];
  ['investigacion','logotipo','tipografia_color','manual','archivos'].forEach((name,i)=>field(pdf.getPage(8),name,timeline[i]||'',292,202+i*51,218,39,{size:15,color:white,align:TextAlignment.Right}));
  field(pdf.getPage(8),'total',cash(q.total),555,515,245,48,{size:30,min:12,color:white,align:TextAlignment.Right,typeface:coolvetica,baseline:548.1754});
  const investment=q.items.map(i=>`${i.service} · ${i.quantity} × ${cash(i.price)}`).join('\n');
  field(pdf.getPage(9),'servicios','Servicios incluidos en este presupuesto:\n\n'+investment,536,330,262,210,{size:11,color:pink,multiline:true,maxChars:700,overflowTitle:'Detalle de servicios'});
 }
 if(!singlePage&&q.terms&&q.terms!==expectedTerms)annex.push(['Condiciones particulares',q.terms]);
 if(!singlePage&&q.schedule)annex.push(['Cronograma y adicionales',q.schedule]);
 if(!singlePage&&q.description)annex.push(['Observaciones del proyecto',q.description]);
 if(annex.length){
  const [w,h]=q.type==='Diseño'?[595.276,841.89]:[841.89,595.276];
  let page,top;
  function next(){page=pdf.addPage([w,h]);page.drawRectangle({x:0,y:0,width:w,height:h,color:q.type==='Diseño'?rgb(.937,.714,.8):rgb(1,.988,.949)});top=48;page.drawText('BOGA / '+clean(q.number||'Presupuesto'),{x:38,y:h-top,size:11,font,color:ink});top+=40;page.drawText('Detalle del presupuesto',{x:38,y:h-top,size:23,font,color:ink});top+=38;}
  function lines(text,size,width){const output=[];for(const para of clean(text).split('\n')){let line='';for(const word of para.split(/\s+/)){if(font.widthOfTextAtSize((line?line+' ':'')+word,size)>width&&line){output.push(line);line=word;}else line+=(line?' ':'')+word;while(font.widthOfTextAtSize(line,size)>width){let count=line.length;while(count>1&&font.widthOfTextAtSize(line.slice(0,count),size)>width)count--;output.push(line.slice(0,count));line=line.slice(count);}}output.push(line);}return output;}
  next();let block=0;
  for(const [title,raw] of annex){validateText(raw);if(top+80>h-45)next();page.drawText(title,{x:38,y:h-top,size:14,font,color:ink});top+=25;
   if(title==='Condiciones particulares'){page.drawText('Estas condiciones prevalecen sobre las generales de la propuesta.',{x:38,y:h-top,size:9,font,color:ink});top+=23;}
   const textLines=lines(raw,11,w-84),lineHeight=font.heightAtSize(11)*1.2;let offset=0;
   while(offset<textLines.length){if(top+28>h-45)next();const count=Math.min(textLines.length-offset,Math.floor((h-45-top)/lineHeight));const part=textLines.slice(offset,offset+count).join('\n');field(page,`anexo_${++block}`,part,37,top-12,w-76,count*lineHeight+10,{size:11,multiline:true,color:ink});top+=count*lineHeight+22;offset+=count;}
  }
 }
 for(const [name,f] of fields){
  const {size,color,baseline,typeface}=styles.get(name),trackedFont=withTracking(typeface);
  f.updateAppearances(typeface,(textField,widget)=>{
   const {width,height}=widget.getRectangle(),bounds={x:1,y:1,width:width-2,height:height-2};
   const options={alignment:textField.getAlignment(),font:trackedFont,fontSize:size,bounds};
   const textLines=textField.isMultiline()?layoutMultilineText(textField.getText()||'',options).lines:[layoutSinglelineText(textField.getText()||'',options).line];
   if(baseline!==undefined)textLines[0].y=baseline;
   const appearance=drawTextField({x:0,y:0,width,height,borderWidth:0,textColor:color,font:typeface.name,fontSize:size,textLines,padding:1});
   const operators=appearance.flatMap(op=>op.name==='BT'?[op,setCharacterSpacing(tracking*size)]:[op]);
   const da=`/${typeface.name} ${size} Tf ${setFillingColor(color)} ${tracking*size} Tc`;
   textField.acroField.setDefaultAppearance(da);widget.setDefaultAppearance(da);
   return operators;
  });
 }
 if(!editable){
  // Remove only our flattened widget references; pdf-lib can leave them in page Annots after deleting the objects.
  const widgetRefs=form.getFields().flatMap(f=>[...f.acroField.normalizedEntries().Kids.asArray()]);
  form.flatten({updateFieldAppearances:false});
  for(const page of pdf.getPages())for(const ref of widgetRefs)page.node.removeAnnot(ref);
 }
 pdf.setTitle(`${q.type} — ${clean(q.number)||'Presupuesto'}`);pdf.setAuthor('BOGA Studio');pdf.setSubject('Presupuesto '+clean(q.number));pdf.setCreator('BOGA Studio CRM');
 return {bytes:Buffer.from(await pdf.save({updateFieldAppearances:false})),pages:pdf.getPageCount(),editable};
}
