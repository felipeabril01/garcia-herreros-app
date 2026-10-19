import { db } from './db';
import { HttpError } from './errors';

const now=()=>new Date().toISOString();
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fail=(s:number,m:string):never=>{throw new HttpError(s,m)};
const str=(v:any,label:string,max=300)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(400,'Revisa '+label);return v.trim()};
const optional=(v:any,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
const amount=(v:any)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<=0||n>100000000)fail(400,'Ingresa un valor válido en pesos');return n};
const month=(v:any)=>{const s=str(v,'periodo',7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(s))fail(400,'Periodo inválido');return s};
const date=(v:any)=>{const s=str(v,'fecha de pago',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T12:00:00Z')))fail(400,'Fecha de pago inválida');if(s>today())fail(400,'La fecha de pago no puede ser futura');return s};

export async function ensureCoachPaymentsTable(){
 const database=db();
 await database.prepare(`CREATE TABLE IF NOT EXISTS coach_payments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  coach_id TEXT NOT NULL,
  coach_name TEXT NOT NULL,
  period TEXT NOT NULL,
  concept TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  paid_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending_confirmation',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  confirmed_by TEXT,
  confirmed_at TEXT
 )`).run();
 await database.prepare('CREATE INDEX IF NOT EXISTS coach_payments_coach_idx ON coach_payments(coach_id,paid_date)').run();
}

async function listPayments(m:any){
 await ensureCoachPaymentsTable();
 const database=db();
 const base=`SELECT cp.*,creator.name AS recorder,confirmer.name AS confirmer
  FROM coach_payments cp
  LEFT JOIN staff creator ON creator.id=cp.created_by
  LEFT JOIN staff confirmer ON confirmer.id=cp.confirmed_by`;
 if(m.role==='admin')return (await database.prepare(base+' ORDER BY cp.paid_date DESC,cp.id DESC LIMIT 500').all()).results;
 return (await database.prepare(base+' WHERE cp.coach_id=? ORDER BY cp.paid_date DESC,cp.id DESC LIMIT 200').bind(m.id).all()).results;
}

export async function payrollHandle(method:string,path:string[],body:any,m:any){
 await ensureCoachPaymentsTable();
 const database=db();
 if(method==='GET'&&path.length===0)return {payments:await listPayments(m)};

 if(method==='POST'&&path.length===0){
  if(m.role!=='admin')fail(403,'Solo administración puede registrar pagos a entrenadores.');
  const requestId=str(body.requestId,'identificador',36);
  if(!/^[0-9a-f-]{36}$/.test(requestId))fail(400,'Identificador inválido');
  const coachId=str(body.coachId,'entrenador',100);
  const coach:any=await database.prepare("SELECT id,name,active,coach_id FROM staff WHERE id=?").bind(coachId).first();
  if(!coach||!coach.active||!coach.coach_id)fail(400,'Selecciona un entrenador activo.');
  const period=month(body.period),concept=str(body.concept,'concepto',120),value=amount(body.amount),methodValue=str(body.method,'medio de pago',30);
  if(!['Efectivo','Transferencia'].includes(methodValue))fail(400,'Medio de pago inválido');
  const reference=optional(body.reference,150);if(methodValue==='Transferencia'&&!reference)fail(400,'Registra la referencia de la transferencia.');
  const paidDate=date(body.paidDate),notes=optional(body.notes,600);
  if(body.confirmed!==true)fail(400,'Confirma que el pago fue realizado.');
  const prior:any=await database.prepare('SELECT id FROM coach_payments WHERE request_id=?').bind(requestId).first();if(prior)return {id:prior.id};
  const res:any=await database.prepare(`INSERT INTO coach_payments(request_id,coach_id,coach_name,period,concept,amount,method,reference,paid_date,notes,status,created_by,created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?, 'pending_confirmation',?,?)`).bind(requestId,coach.id,coach.name,period,concept,value,methodValue,reference,paidDate,notes,m.id,now()).run();
  const id=String(res.meta?.last_row_id||'');
  await database.prepare("INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),m.id,'coach_payment_registered',id,now()).run();
  return {id:Number(id)};
 }

 if(method==='POST'&&path[0]&&path[1]==='delete'){
  if(m.role!=='admin')fail(403,'Solo administración puede eliminar pagos a entrenadores.');
  const id=Number(path[0]);if(!Number.isSafeInteger(id)||id<=0)fail(400,'Pago inválido');
  const p:any=await database.prepare('SELECT * FROM coach_payments WHERE id=?').bind(id).first();
  if(!p)fail(404,'Pago no encontrado');
  const when=now();
  await database.batch([
   database.prepare('DELETE FROM coach_payments WHERE id=?').bind(id),
   database.prepare("INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),m.id,'coach_payment_deleted',String(id),when)
  ]);
  return {id,deleted:true};
 }

 if(method==='POST'&&path[0]&&path[1]==='confirm'){
  const id=Number(path[0]);if(!Number.isSafeInteger(id)||id<=0)fail(400,'Pago inválido');
  const p:any=await database.prepare('SELECT * FROM coach_payments WHERE id=?').bind(id).first();if(!p)fail(404,'Pago no encontrado');
  if(p.coach_id!==m.id)fail(403,'Solo el entrenador destinatario puede confirmar este pago.');
  if(p.status==='confirmed')return {id,status:'confirmed'};
  if(p.status!=='pending_confirmation')fail(409,'Este pago ya no está pendiente de confirmación.');
  if(body.confirmed!==true)fail(400,'Confirma que recibiste el pago.');
  const when=now();
  await database.batch([
   database.prepare("UPDATE coach_payments SET status='confirmed',confirmed_by=?,confirmed_at=? WHERE id=? AND status='pending_confirmation'").bind(m.id,when,id),
   database.prepare("INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),m.id,'coach_payment_confirmed',String(id),when)
  ]);
  return {id,status:'confirmed'};
 }

 fail(404,'Ruta de pagos a entrenadores no encontrada');
}
