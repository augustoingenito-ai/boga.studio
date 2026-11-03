import { test, expect } from '@playwright/test';
test('bandeja: mensaje entrante, respuesta explícita y estado aceptado',async({page})=>{
 const clients=[{id:'wa-client',name:'Marca Sol',phone:'+5491112345678'}];
 const messages=[{id:'in-1',clientId:'wa-client',phone:clients[0].phone,direction:'in',type:'text',text:'Hola, quiero branding',timestamp:Date.now(),status:'received'}];
 const config={configured:true,connection:{name:'BOGA',phone:'+5491198765432'}};
 await page.route('**/api/state',r=>r.fulfill({json:{clients,quotes:[],jobs:[],notes:[],whatsappMessages:messages}}));
 await page.route('**/api/whatsapp/status',r=>r.fulfill({json:config}));
 await page.route('**/api/whatsapp/messages',async r=>{if(r.request().method()==='POST'){const payload=r.request().postDataJSON();expect(payload.clientId).toBe('wa-client');expect(payload.text).toBe('Hola, te preparo una propuesta');messages.push({id:'out-1',clientId:'wa-client',phone:clients[0].phone,direction:'out',type:'text',text:payload.text,timestamp:Date.now(),status:'accepted'});await r.fulfill({json:messages.at(-1),status:201});}else await r.fulfill({json:{messages,clients}});});
 await page.goto('/');await page.getByRole('button',{name:'WhatsApp',exact:true}).click();await expect(page.locator('#wa-history')).toContainText('Hola, quiero branding');await page.getByLabel('Tu respuesta').fill('Hola, te preparo una propuesta');await page.getByRole('button',{name:'Enviar por WhatsApp'}).click();await expect(page.locator('#wa-history')).toContainText('Aceptado por Meta');await expect(page.getByLabel('Tu respuesta')).toHaveValue('');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/boga-whatsapp.png',fullPage:true});
});
