import { env } from 'cloudflare:workers';
import { getLocalUser } from '../../../../../../lib/club/auth';
import { db } from '../../../../../../lib/club/db';
import { buildReceiptModel,receiptHtml,bytesToBase64 } from '../../../../../../lib/club/receipt-document';

export const dynamic='force-dynamic';

function safeHtml(v:any){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
function money(n:number){return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n)}

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const requestOrigin=req.headers.get('origin');
    if(!requestOrigin||requestOrigin!==new URL(req.url).origin)return Response.json({error:'Origen no válido.'},{status:403});
    const user:any=await getLocalUser();
    if(!user)return Response.json({error:'Inicia sesión para continuar.'},{status:401});
    if(user.role!=='admin')return Response.json({error:'Solo los administrativos pueden enviar comprobantes.'},{status:403});
    const apiKey=(env as unknown as {RESEND_API_KEY?:string}).RESEND_API_KEY;
    if(!apiKey)return Response.json({error:'El servicio de correo todavía no está configurado.'},{status:503});

    const {id}=await params,paymentId=Number(id);
    if(!Number.isSafeInteger(paymentId)||paymentId<=0)return Response.json({error:'Comprobante inválido.'},{status:400});
    const database=db();
    const p:any=await database.prepare('SELECT payments.*,staff.name AS recorder,athletes.email AS guardian_email FROM payments LEFT JOIN staff ON staff.id=payments.created_by JOIN athletes ON athletes.id=payments.athlete_id WHERE payments.id=?').bind(paymentId).first();
    if(!p)return Response.json({error:'Comprobante no encontrado.'},{status:404});
    if(!p.guardian_email)return Response.json({error:'La ficha no tiene correo del acudiente.'},{status:400});
    const lines:any[]=(await database.prepare('SELECT allocations.amount,charges.kind,charges.period,charges.source FROM allocations JOIN charges ON charges.id=allocations.charge_id WHERE allocations.payment_id=? ORDER BY charges.period').bind(paymentId).all()).results as any[];
    const balances:any[]=(await database.prepare("SELECT c.*,c.amount-COALESCE((SELECT SUM(al.amount) FROM allocations al JOIN payments p2 ON p2.id=al.payment_id WHERE al.charge_id=c.id AND p2.status='confirmed'),0) AS balance FROM charges c WHERE c.athlete_id=?").bind(p.athlete_id).all()).results as any[];
    const currentBalance=balances.filter(c=>c.status==='active').reduce((s,c)=>s+Number(c.balance||0),0);
    const receiptModel=buildReceiptModel(p,lines,currentBalance);
    const appOrigin=new URL(req.url).origin;
    const browser=(env as unknown as {BROWSER?:{quickAction:(action:string,input:any)=>Promise<Response>}}).BROWSER;
    if(!browser)return Response.json({error:'El generador institucional de PDF todavía no está disponible.'},{status:503});
    const document='<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+receiptModel.number+'</title></head><body>'+receiptHtml(receiptModel,appOrigin)+'</body></html>';
    let pdf:Uint8Array;
    try{
      const rendered=await browser.quickAction('pdf',{
        html:document,
        addStyleTag:[{url:appOrigin+'/receipt.css'}],
        pdfOptions:{
          format:'a4',
          landscape:false,
          printBackground:true,
          preferCSSPageSize:true,
          displayHeaderFooter:false,
          margin:{top:'0',right:'0',bottom:'0',left:'0'}
        }
      });
      if(!rendered.ok)throw new Error('Browser Run respondió '+rendered.status);
      pdf=new Uint8Array(await rendered.arrayBuffer());
      if(pdf.length<1000)throw new Error('El PDF generado está vacío');
    }catch(error){
      console.error('Browser PDF',error instanceof Error?error.message:'Unknown');
      return Response.json({error:'No se pudo generar el comprobante institucional. Intenta nuevamente en unos segundos.'},{status:503});
    }
    const receipt=receiptModel.number;
    const html=`<div style="font-family:Arial,sans-serif;color:#14254b;line-height:1.55"><h2 style="margin-bottom:8px">García Herreros FC</h2><p>Apreciado(a) acudiente:</p><p>Reciba un cordial saludo de García Herreros FC.</p><p>Adjuntamos el comprobante <strong>${receipt}</strong> correspondiente al pago registrado para <strong>${safeHtml(p.athlete_name)}</strong> por valor de <strong>${money(Number(p.amount))}</strong>.</p><p>Por favor conserve este mensaje y el archivo adjunto como soporte de la transacción.</p><p>Atentamente,<br><strong>García Herreros FC</strong></p></div>`;

    const rr=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},
      body:JSON.stringify({
        from:'García Herreros FC <pagos@garciaherrerosfc.com>',
        to:[p.guardian_email],
        subject:'García Herreros FC · Comprobante de pago '+receipt,
        html,
        attachments:[{filename:'Comprobante-'+receipt+'.pdf',content:bytesToBase64(pdf)}]
      })
    });
    let data:any={};try{data=await rr.json()}catch{}
    if(!rr.ok){
      const raw=String(data?.message||data?.error||'No se pudo enviar el correo.');
      const msg=/domain|testing|recipient|verify/i.test(raw)?'Resend bloqueó este destinatario porque todavía no hay un dominio del club verificado. La integración ya está lista; para enviar a padres de familia necesitaremos verificar un dominio propio.':raw.slice(0,300);
      return Response.json({error:msg},{status:400});
    }
    const now=new Date().toISOString();
    await database.prepare("INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),user.id,'receipt_emailed',String(paymentId),now).run();
    return Response.json({ok:true,id:data?.id||null,to:p.guardian_email},{headers:{'Cache-Control':'no-store'}});
  }catch(e){
    console.error('Receipt email',e instanceof Error?e.message:'Unknown');
    return Response.json({error:'No se pudo enviar el comprobante. Intenta nuevamente.'},{status:503});
  }
}
