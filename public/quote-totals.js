export const collectionType='Diseño de colección';
// Round each monetary line to cents; quantities remain positive, unit prices may be negative.
const cents=value=>Math.sign(value)*Math.round((Math.abs(value)+Number.EPSILON)*100);
export function quoteTotals(q){
 const subtotalCents=(q.items||[]).reduce((sum,item)=>sum+cents(Number(item.quantity)*Number(item.price)),0);
 const discountCents=q.type===collectionType&&q.hadConsultation===true?cents(Number(q.consultationAmount||0)):0;
 if(!Number.isSafeInteger(subtotalCents)||!Number.isSafeInteger(discountCents)||!Number.isSafeInteger(subtotalCents-discountCents))throw Error('Los importes exceden el rango permitido.');
 return {subtotal:subtotalCents/100,consultationDiscount:discountCents/100,total:(subtotalCents-discountCents)/100};
}
