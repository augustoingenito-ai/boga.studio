const dayMs=86400000;
export const studioToday=(now=new Date())=>now.toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'});
export function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function addDays(value,days){
 if(!validDate(value))return '';
 const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);
}
export const daysUntil=(value,today=studioToday())=>validDate(value)&&validDate(today)?Math.round((Date.parse(value+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/dayMs):null;
export function deadlineText(value,today=studioToday()){
 const days=daysUntil(value,today);
 if(days===null)return 'Sin fecha';if(days===0)return 'Hoy';if(days===1)return 'Falta 1 día';if(days>1)return `Faltan ${days} días`;
 return `Vencido hace ${-days} ${days===-1?'día':'días'}`;
}
export function quoteFollowupOn(quote){
 return quote.status==='Enviado'&&!quote.respondedOn&&!quote.followedUpOn?addDays(quote.sentOn,7):'';
}
export function quoteSchedule(previous,input,today=studioToday()){
 const value={...previous,...input};
 if(value.status==='Enviado'&&previous?.status!=='Enviado'){
  value.sentOn=input.sentOn||today;
  value.respondedOn=input.respondedOn||'';
  value.followedUpOn=input.followedUpOn||'';
 }
 value.followupOn=quoteFollowupOn(value);
 return value;
}
export function jobMilestones(job){
 if(job.stage==='Finalizado')return [];
 const events=[];
 if(job.stage!=='Entrega'&&validDate(job.reviewDue))events.push({key:`review-${job.id}`,kind:'review',date:job.reviewDue,label:'Revisar',title:job.title,clientId:job.clientId,recordId:job.id,action:'job',stage:job.stage});
 if(validDate(job.due))events.push({key:`delivery-${job.id}`,kind:'delivery',date:job.due,label:'Entregar',title:job.title,clientId:job.clientId,recordId:job.id,action:'job',stage:job.stage});
 return events;
}
export function agendaEvents(state){
 const events=(state.jobs||[]).flatMap(jobMilestones);
 for(const quote of state.quotes||[]){const date=quoteFollowupOn(quote);if(date)events.push({key:`quote-${quote.id}`,kind:'quote',date,label:'Seguimiento de presupuesto',title:quote.number||quote.title||'Presupuesto',clientId:quote.clientId,recordId:quote.id,action:'quote'});}
 for(const client of state.clients||[])if(validDate(client.followup))events.push({key:`client-${client.id}`,kind:'client',date:client.followup,label:'Seguimiento de cliente',title:client.nextAction||'Retomar contacto',clientId:client.id,recordId:client.id,action:'detail'});
 return events.sort((a,b)=>a.date.localeCompare(b.date)||a.key.localeCompare(b.key));
}
export function nextJobMilestone(job){
 const events=jobMilestones(job);return events.find(e=>e.kind==='review')||events[0]||null;
}
