import { PDFDocument, PDFName, TextAlignment, layoutMultilineText, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'node:fs';
import { designTerms, brandTerms } from './public/quote-defaults.js';
const original={Diseño:readFileSync(new URL('./templates/design.pdf',import.meta.url)),Branding:readFileSync(new URL('./templates/branding.pdf',import.meta.url))};
const fontBytes=readFileSync(new URL('./templates/Poppins-Regular.ttf',import.meta.url));
const ink=rgb(35/255,31/255,32/255),white=rgb(246/255,243/255,233/255),green=rgb(56/255,172/255,98/255),pink=rgb(241/255,200/255,216/255);
const cash=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0,maximumFractionDigits:2}).format(n||0).replace(/\u00a0/g,' ');
const clean=v=>String(v??'').replace(/\r\n/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
const date=v=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v.split('-').reverse().join('/'):clean(v);
export async function quotePDF(q,client,{editable=false}={}){
 if(!original[q.type])throw Object.assign(new Error('Seleccioná Branding o Diseño.'),{status:400});
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const template=await PDFDocument.load(original[q.type]);
 const copies=q.type==='Diseño'?Math.max(1,Math.ceil(q.items.length/2)):1;
 for(let i=0;i<copies;i++)for(const page of await pdf.copyPages(template,template.getPageIndices()))pdf.addPage(page);
 const font=await pdf.embedFont(fontBytes,{subset:false});
 const form=pdf.getForm(),fields=new Map(),annex=[];
 // Readers need the full font in AcroForm resources to edit names and prices later.
 form.acroForm.dict.set(PDFName.of('DR'),pdf.context.obj({Font:{[font.name]:font.ref}}));
 const charset=new Set(font.getCharacterSet());
 const validateText=text=>{for(const char of text)if(char!=='\n'&&!charset.has(char.codePointAt(0)))throw Object.assign(new Error('El presupuesto contiene caracteres que Poppins no puede representar (por ejemplo emojis). Revisá los datos antes de descargar.'),{status:422});};
 function field(page,name,value,x,top,width,height,{size=12,min=8,color=ink,align=TextAlignment.Left,multiline=false,maxChars=0,overflowTitle='Detalle completo'}={}){
  const fullText=clean(value);let text=fullText,overflowed=false;validateText(text);const overflow=()=>{if(!overflowed){annex.push([overflowTitle,fullText]);overflowed=true;}};
  if(maxChars&&text.length>maxChars){overflow();text=text.slice(0,maxChars-20)+'… (ver anexo)';}
  let actual=size;
  const longest=Math.max(0,...text.split('\n').map(t=>font.widthOfTextAtSize(t,actual)));
  if(!multiline&&longest>width-6){actual=Math.max(min,actual*(width-6)/longest);if(font.widthOfTextAtSize(text,actual)>width-6){overflow();while(text.length&&font.widthOfTextAtSize(text+'…',actual)>width-6)text=text.slice(0,-1);text+='…';}}
  if(multiline){const fits=()=>layoutMultilineText(text,{alignment:align,font,fontSize:actual,bounds:{x:1,y:1,width:width-2,height:height-2}}).lines.every(l=>l.y>=0&&l.width<=width-2);while(actual>min&&!fits())actual=Math.max(min,actual-.5);if(!fits()){overflow();while(text.length&&!fits())text=text.slice(0,-1);text=text.slice(0,-18)+'… (ver anexo)';while(text.length>18&&!fits())text=text.slice(0,-19)+'… (ver anexo)';}}
  let f=fields.get(name);if(!f){f=form.createTextField(name);if(multiline)f.enableMultiline();f.setAlignment(align);f.setText(text);f.acroField.setDefaultAppearance(`/${font.name} ${actual} Tf 0 g`);f.setFontSize(actual);fields.set(name,f);}
  f.addToPage(page,{x,y:page.getHeight()-top-height,width,height,font,textColor:color,backgroundColor:undefined,borderColor:undefined,borderWidth:0});
  return f;
 }
 if(q.type==='Diseño'){
  const pages=pdf.getPages();
  for(let n=0;n<pages.length;n++){
   const p=pages[n];
   field(p,'cliente',client.name,113,44,330,28,{size:16});
   field(p,'fecha',date(q.date),113,70,310,27,{size:16});
   field(p,'validez',q.validityText||date(q.validUntil),113,95,310,27,{size:16});
   field(p,'referencia',q.number,39,746,370,19,{size:10});
   q.items.slice(n*2,n*2+2).forEach((item,row)=>{
    const top=row===0?303:344,index=n*2+row;
    field(p,`servicio_${index+1}`,item.service,42,top,300,35,{size:11,multiline:true,maxChars:130,overflowTitle:`Servicio ${index+1}`});
    field(p,`cantidad_${index+1}`,String(item.quantity),352,top,75,35,{size:13,align:TextAlignment.Center});
    field(p,`precio_unitario_${index+1}`,cash(item.price),437,top,115,35,{size:12,min:8,align:TextAlignment.Right});
   });
   if(n===pages.length-1)field(p,'total',cash(q.total),43,447,506,33,{size:22,align:TextAlignment.Right});
   else field(p,`continuacion_${n+1}`,'Continúa en la siguiente página',43,447,506,33,{size:12,align:TextAlignment.Right});
   if(pages.length>1)field(p,`pagina_${n+1}`,`${n+1} / ${pages.length}`,467,487,85,16,{size:8,align:TextAlignment.Right});
  }
 }else{
  const p=pdf.getPage(0);
  field(p,'cliente',client.name,48,365,560,33,{size:22,color:green});
  field(p,'fecha',q.date?'Fecha: '+date(q.date):'',48,459,240,23,{size:12,color:green});
  field(p,'validez',q.validityText?'Validez: '+q.validityText:q.validUntil?'Validez: '+date(q.validUntil):'',300,459,310,23,{size:12,color:green});
  field(p,'referencia',q.number,48,490,400,23,{size:11,color:green});
  const timeline=Array.isArray(q.timeline)?q.timeline:[];
  ['investigacion','logotipo','tipografia_color','manual','archivos'].forEach((name,i)=>field(pdf.getPage(8),name,timeline[i]||'',292,202+i*51,218,39,{size:15,color:white,align:TextAlignment.Right}));
  field(pdf.getPage(8),'total',cash(q.total),555,515,245,48,{size:30,min:12,color:white,align:TextAlignment.Right});
  const investment=q.items.map(i=>`${i.service} · ${i.quantity} × ${cash(i.price)}`).join('\n');
  field(pdf.getPage(9),'servicios','Servicios incluidos en este presupuesto:\n\n'+investment,536,330,262,210,{size:11,color:pink,multiline:true,maxChars:700,overflowTitle:'Detalle de servicios'});
 }
 const expectedTerms=q.type==='Diseño'?designTerms:brandTerms;
 if(q.terms&&q.terms!==expectedTerms)annex.push(['Condiciones particulares',q.terms]);
 if(q.schedule)annex.push(['Cronograma y adicionales',q.schedule]);
 if(q.description)annex.push(['Observaciones del proyecto',q.description]);
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
 form.updateFieldAppearances(font);
 if(!editable){
  // Remove only our flattened widget references; pdf-lib can leave them in page Annots after deleting the objects.
  const widgetRefs=form.getFields().flatMap(f=>[...f.acroField.normalizedEntries().Kids.asArray()]);
  form.flatten({updateFieldAppearances:false});
  for(const page of pdf.getPages())for(const ref of widgetRefs)page.node.removeAnnot(ref);
 }
 pdf.setTitle(`${q.type} — ${clean(q.number)||'Presupuesto'}`);pdf.setAuthor('BOGA Studio');pdf.setSubject('Presupuesto '+clean(q.number));pdf.setCreator('BOGA Studio CRM');
 return {bytes:Buffer.from(await pdf.save({updateFieldAppearances:false})),pages:pdf.getPageCount(),editable};
}
