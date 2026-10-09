import {db} from './db';
import {HttpError} from './errors';
import {buildReceiptModel,receiptHtml} from './receipt-document';
export const CUTOFF='2026-10';
const now=()=>new Date().toISOString();
export const financeDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fail=(s:number,m:string):never=>{throw new HttpError(s,m)};
const str=(v:any,label:string,max=500)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(400,'Revisa '+label);return v.trim()};
const requestId=(v:any)=>{const id=str(v,'identificador',36);if(!/^[0-9a-f-]{36}$/.test(id))fail(400,'Identificador inválido');return id};
function month(v:any){const s=str(v,'mes',7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)||s<'2000-01'||s>'2100-12')fail(400,'Mes inválido');return s}
function date(v:any){const s=str(v,'fecha',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T12:00:00Z'))||new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s)fail(400,'Fecha inválida');return s}
function amount(v:any){if(!Number.isSafeInteger(v)||v<=0||v>100000000)fail(400,'Ingresa un valor entero positivo en pesos');return v}
function log(m:any,action:string,id:string){return db().prepare('INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),m.id,action,id,now())}
async function athlete(id:any){const a:any=await db().prepare('SELECT * FROM athletes WHERE id=?').bind(str(id,'deportista',100)).first();if(!a)fail(404,'Deportista no encontrado');return a}
export const balancesSQL=`SELECT c.*,c.amount-COALESCE((SELECT SUM(al.amount) FROM allocations al JOIN payments p ON p.id=al.payment_id WHERE al.charge_id=c.id AND p.status='confirmed'),0) AS balance FROM charges c`;
const chargeStmt=(a:string,kind:string,period:string,value:number,source:string,actor:string,notes='')=>db().prepare("INSERT OR IGNORE INTO charges(id,athlete_id,kind,period,amount,source,notes,status,created_by,created_at) VALUES (?,?,?,?,?,?,?,'active',?,?)").bind(kind+':'+a+':'+period,a,kind,period,value,source,notes,actor,now());
export async function ensureMonthlyCharges(asOf=financeDate()){
 const profiles:any[]=(await db().prepare('SELECT * FROM billing').all()).results;if(!profiles.length)return;
 const last=asOf.slice(0,7),first=profiles.map(p=>p.start_month).sort()[0];if(last<first)return;
 const stmts=[];for(let y=Number(first.slice(0,4));y<=Number(last.slice(0,4));y++)for(let mm=1;mm<=12;mm++){
  const period=y+'-'+String(mm).padStart(2,'0');if(period<first||period>last)continue;
  stmts.push(db().prepare("INSERT OR IGNORE INTO charges(id,athlete_id,kind,period,amount,source,notes,status,created_by,created_at) SELECT 'mensualidad:'||a.id||':'||?,a.id,'mensualidad',?,50000,'automatic','Mensualidad del mes calendario','active','system',? FROM billing b JOIN athletes a ON a.id=b.athlete_id WHERE b.start_month<=? AND a.modality='Mensual' AND a.status='active'").bind(period,period,now(),period));
 }
 for(let y=2027;y<=Number(asOf.slice(0,4));y++)stmts.push(db().prepare("INSERT OR IGNORE INTO charges(id,athlete_id,kind,period,amount,source,notes,status,created_by,created_at) SELECT 'inscripcion:'||a.id||':'||?,a.id,'inscripcion',?,40000,'automatic','Renovación anual','active','system',? FROM billing b JOIN athletes a ON a.id=b.athlete_id WHERE b.annual_start_year<=? AND a.status='active'").bind(String(y),String(y),now(),y));
 for(let i=0;i<stmts.length;i+=40)await db().batch(stmts.slice(i,i+40));
}
export function eligibility(a:any,charges:any[],exceptions:any[],profile:any,asOf:string){
 if(a.status==='incomplete')return {status:'review',label:'Registro incompleto',evaluatedAt:asOf};
 if(asOf<CUTOFF+'-01')return {status:'scheduled',label:'Control desde 1 oct.',evaluatedAt:asOf};
 const overdue=charges.some(c=>c.athlete_id===a.id&&c.kind==='mensualidad'&&c.status==='active'&&c.balance>0&&asOf>=c.period+'-16');
 const exception=exceptions.find(e=>e.athlete_id===a.id&&!e.revoked_at&&e.start_date<=asOf&&e.end_date>=asOf);
 if(overdue)return exception?{status:'exception',label:'Permiso temporal',until:exception.end_date,evaluatedAt:asOf}:{status:'restricted',label:'Restringido por mensualidad',evaluatedAt:asOf};
 if(!profile)return {status:'review',label:'Cuenta por revisar',evaluatedAt:asOf};
 const pending=charges.some(c=>c.athlete_id===a.id&&c.kind==='mensualidad'&&c.status==='active'&&c.balance>0&&c.period<=asOf.slice(0,7));
 return {status:pending?'notice':'eligible',label:pending?'Habilitado · pago pendiente':'Habilitado',evaluatedAt:asOf};
}
export async function enrichEligibility(athletes:any[]){const cs=(await db().prepare(balancesSQL).all()).results,es=(await db().prepare('SELECT * FROM exceptions WHERE revoked_at IS NULL').all()).results,bs=(await db().prepare('SELECT * FROM billing').all()).results;return athletes.map(a=>({...a,eligibility:eligibility(a,cs,es,bs.find((b:any)=>b.athlete_id===a.id),financeDate())}));}
export async function financeHandle(method:string,path:string[],body:any,m:any){
 if(m.role!=='admin')fail(403,'Solo los administrativos pueden consultar y registrar movimientos económicos.');
 const database=db();
 if(method==='GET'&&path[0]==='overview'){
  await ensureMonthlyCharges();const cs=(await database.prepare(balancesSQL+' ORDER BY c.period,c.created_at').all()).results;
  const ps=(await database.prepare('SELECT payments.*,staff.name AS recorder FROM payments LEFT JOIN staff ON staff.id=payments.created_by ORDER BY payments.id DESC LIMIT 300').all()).results;
  return {cutoff:CUTOFF,today:financeDate(),charges:cs,payments:ps,billing:(await database.prepare('SELECT * FROM billing').all()).results,exceptions:(await database.prepare('SELECT exceptions.*,staff.name AS author FROM exceptions LEFT JOIN staff ON staff.id=exceptions.created_by ORDER BY exceptions.created_at DESC').all()).results};
 }
 if(method==='POST'&&path[0]==='reports'&&path[1]==='income'){
  const start=date(body.startDate),end=date(body.endDate);if(end<start)fail(400,'La fecha final debe ser igual o posterior a la inicial.');
  const payments:any[]=(await database.prepare(`SELECT p.id,p.athlete_id,p.athlete_name,p.amount,p.method,p.payer,p.reference,p.paid_date,p.created_at,a.category,
    GROUP_CONCAT(c.kind||' '||c.period, ', ') AS concepts
    FROM payments p
    LEFT JOIN athletes a ON a.id=p.athlete_id
    LEFT JOIN allocations al ON al.payment_id=p.id
    LEFT JOIN charges c ON c.id=al.charge_id
    WHERE p.status='confirmed' AND p.paid_date BETWEEN ? AND ?
    GROUP BY p.id
    ORDER BY p.paid_date DESC,p.id DESC`).bind(start,end).all()).results;
  const concepts:any[]=(await database.prepare(`SELECT c.kind,SUM(al.amount) AS total
    FROM allocations al JOIN payments p ON p.id=al.payment_id JOIN charges c ON c.id=al.charge_id
    WHERE p.status='confirmed' AND p.paid_date BETWEEN ? AND ?
    GROUP BY c.kind ORDER BY total DESC`).bind(start,end).all()).results;
  const methods:any[]=(await database.prepare(`SELECT method,SUM(amount) AS total,COUNT(*) AS count
    FROM payments WHERE status='confirmed' AND paid_date BETWEEN ? AND ?
    GROUP BY method ORDER BY total DESC`).bind(start,end).all()).results;
  const categories:any[]=(await database.prepare(`SELECT COALESCE(a.category,'Sin categoría') AS category,SUM(p.amount) AS total,COUNT(*) AS count
    FROM payments p LEFT JOIN athletes a ON a.id=p.athlete_id
    WHERE p.status='confirmed' AND p.paid_date BETWEEN ? AND ?
    GROUP BY COALESCE(a.category,'Sin categoría') ORDER BY total DESC`).bind(start,end).all()).results;
  const total=payments.reduce((sum:number,p:any)=>sum+Number(p.amount||0),0);
  return {startDate:start,endDate:end,total,count:payments.length,payments,concepts,methods,categories};
 }
 if(method==='POST'&&path[0]==='activate'){
  const a=await athlete(body.athleteId);if(a.status!=='active')fail(400,'Completa la ficha del deportista antes de activar su cuenta.');const start=month(body.startMonth);if(start<CUTOFF||start>financeDate().slice(0,7)&&start!==CUTOFF)fail(400,'El inicio debe ser octubre de 2026 o un mes posterior ya iniciado.');
  if(body.verified!==true)fail(400,'Confirma el mes de inicio y la revisión de saldos.');
  const current:any=await database.prepare('SELECT * FROM billing WHERE athlete_id=?').bind(a.id).first();if(current){if(current.start_month!==start)fail(409,'La cuenta ya tiene un inicio establecido; no se modificó.');return {athleteId:a.id};}
  const stmts=[database.prepare('INSERT OR IGNORE INTO billing(athlete_id,start_month,annual_start_year,created_by,created_at) VALUES (?,?,?,?,?)').bind(a.id,start,Number(start.slice(0,4))+1,m.id,now())];
  if(a.modality==='Mensual')stmts.push(chargeStmt(a.id,'mensualidad',start,50000,'activation',m.id));
  if(body.enrollmentDue===true)stmts.push(chargeStmt(a.id,'inscripcion',start.slice(0,4),40000,'manual',m.id,'Inscripción pendiente confirmada al activar la cuenta'));
  stmts.push(log(m,'billing_activated',a.id));await database.batch(stmts);await ensureMonthlyCharges();return {athleteId:a.id};
 }
 if(method==='POST'&&path[0]==='charges'&&path.length===1){
  const a=await athlete(body.athleteId),kind=str(body.kind,'concepto',30);let period='',value=0,source='manual',notes=typeof body.notes==='string'?body.notes.trim().slice(0,1000):'';
  if(kind==='legacy'){period=month(body.period);if(period>=CUTOFF)fail(400,'Los saldos anteriores deben corresponder a meses anteriores a octubre de 2026');if(body.verified!==true||!notes)fail(400,'Confirma la deuda y escribe cómo se verificó');value=amount(body.amount);source='legacy';}
  else if(kind==='mensualidad'){period=month(body.period);if(period<CUTOFF)fail(400,'Registra meses anteriores como saldo verificado');if(a.modality!=='Mensual')fail(400,'El deportista no está en modalidad mensual');value=50000;}
  else if(kind==='inscripcion'){period=str(body.period,'año',4);if(!/^20\d{2}$/.test(period)||Number(period)<2026)fail(400,'Año inválido');value=40000;}
  else if(kind==='practica'){period=date(body.period);if(period<CUTOFF+'-01')fail(400,'El cobro por práctica inicia en octubre de 2026');if(a.modality!=='Por práctica')fail(400,'El deportista no está en modalidad por práctica');value=7000;}
  else fail(400,'Concepto inválido');
  const actualKind=kind==='legacy'?'mensualidad':kind,id=actualKind+':'+a.id+':'+period;
  const existing:any=await database.prepare('SELECT * FROM charges WHERE id=?').bind(id).first();if(existing)fail(409,'Ya existe ese cobro para el deportista y periodo. No se duplicó.');
  await database.batch([chargeStmt(a.id,actualKind,period,value,source,m.id,notes),log(m,source==='legacy'?'legacy_balance_registered':'charge_created',id)]);return {id};
 }
 if(method==='POST'&&path[0]==='payments'&&path.length===1){
  const a=await athlete(body.athleteId),key=requestId(body.requestId),payer=str(body.payer,'persona que paga',100),methodValue=str(body.method,'medio',30),paidDate=date(body.paidDate);
  if(!['Efectivo','Transferencia'].includes(methodValue))fail(400,'Medio no válido');if(paidDate>financeDate()||paidDate<'2026-09-29')fail(400,'Registra únicamente pagos recibidos desde el inicio del sistema, sin fechas futuras');if(body.confirmed!==true)fail(400,'Confirma la recepción o verificación del dinero');
  const reference=typeof body.reference==='string'?body.reference.trim().slice(0,150):'';if(methodValue==='Transferencia'&&!reference)fail(400,'Registra la referencia de la transferencia verificada');
  if(!Array.isArray(body.allocations)||!body.allocations.length||body.allocations.length>36)fail(400,'Selecciona al menos un cobro');
  const lines=body.allocations.map((l:any)=>({id:str(l.chargeId,'cobro',160),amount:amount(l.amount)}));if(new Set(lines.map((l:any)=>l.id)).size!==lines.length)fail(400,'Un cobro está repetido');const total=lines.reduce((s:number,l:any)=>s+l.amount,0);amount(total);
  const payload=JSON.stringify({athleteId:a.id,actor:m.id,payer,method:methodValue,paidDate,reference,lines:[...lines].sort((a:any,b:any)=>a.id.localeCompare(b.id))});
  const prior:any=await database.prepare('SELECT * FROM payments WHERE request_id=?').bind(key).first();if(prior){if(prior.created_by!==m.id||prior.athlete_id!==a.id||prior.amount!==total||prior.payload!==payload)fail(409,'El identificador ya fue usado');return {id:prior.id};}
  const outstanding=`SELECT SUM(al.amount) FROM allocations al JOIN payments p ON p.id=al.payment_id WHERE al.charge_id=c.id AND p.status='confirmed'`;
  const stmts=[database.prepare(`INSERT OR IGNORE INTO payments(request_id,payload,athlete_id,athlete_name,amount,method,payer,reference,paid_date,status,created_by,created_at) SELECT ?,?,?,?,?,?,?,?,?,'confirmed',?,? WHERE NOT EXISTS (SELECT 1 FROM json_each(?) j LEFT JOIN charges c ON c.id=json_extract(j.value,'$.id') WHERE c.id IS NULL OR c.athlete_id<>? OR c.status<>'active' OR json_extract(j.value,'$.amount')>c.amount-COALESCE((${outstanding}),0))`).bind(key,payload,a.id,a.name,total,methodValue,payer,reference,paidDate,m.id,now(),JSON.stringify(lines),a.id)];
  for(const l of lines)stmts.push(database.prepare('INSERT OR IGNORE INTO allocations(payment_id,charge_id,amount) SELECT id,?,? FROM payments WHERE request_id=? AND payload=?').bind(l.id,l.amount,key,payload));
  stmts.push(database.prepare("INSERT OR IGNORE INTO audit(id,actor,action,entity_id,created_at) SELECT ?,?,'payment_confirmed',CAST(id AS TEXT),? FROM payments WHERE request_id=?").bind('payment:'+key,m.id,now(),key));
  await database.batch(stmts);const saved:any=await database.prepare('SELECT id FROM payments WHERE request_id=? AND payload=?').bind(key,payload).first();if(!saved)fail(409,'El saldo cambió o uno de los valores supera el pendiente. Actualiza los cobros antes de registrar el pago.');return {id:saved.id};
 }
 if(method==='GET'&&path[0]==='payments'&&path[1]){
  const p:any=await database.prepare('SELECT payments.*,staff.name AS recorder FROM payments LEFT JOIN staff ON staff.id=payments.created_by WHERE payments.id=?').bind(Number(path[1])).first();if(!p)fail(404,'Comprobante no encontrado');
  const lines=(await database.prepare('SELECT allocations.amount,charges.kind,charges.period,charges.source FROM allocations JOIN charges ON charges.id=allocations.charge_id WHERE allocations.payment_id=? ORDER BY charges.period').bind(p.id).all()).results;
  const cs=(await database.prepare(balancesSQL+' WHERE c.athlete_id=?').bind(p.athlete_id).all()).results;const currentBalance=cs.filter((c:any)=>c.status==='active').reduce((s:number,c:any)=>s+c.balance,0);const receipt=buildReceiptModel(p,lines,currentBalance);return {payment:p,lines,currentBalance,receipt,receiptHtml:receiptHtml(receipt)};
 }
 if(method==='POST'&&path[0]==='payments'&&path[1]&&path[2]==='void'){
  const reason=str(body.reason,'motivo de anulación',500),p:any=await database.prepare('SELECT * FROM payments WHERE id=?').bind(Number(path[1])).first();if(!p)fail(404,'Pago no encontrado');if(p.status==='void')return {id:p.id};
  await database.batch([database.prepare("UPDATE payments SET status='void',void_reason=?,void_by=?,void_at=? WHERE id=? AND status='confirmed'").bind(reason,m.id,now(),p.id),log(m,'payment_voided',String(p.id))]);return {id:p.id};
 }
 if(method==='POST'&&path[0]==='charges'&&path[1]&&path[2]==='void'){
  const reason=str(body.reason,'motivo de anulación',500),c:any=await database.prepare(balancesSQL+' WHERE c.id=?').bind(path[1]).first();if(!c)fail(404,'Cobro no encontrado');if(c.status==='void')return {id:c.id};
  const result=await database.batch([database.prepare("UPDATE charges SET status='void',void_reason=?,void_by=?,void_at=? WHERE id=? AND NOT EXISTS (SELECT 1 FROM allocations al JOIN payments p ON p.id=al.payment_id WHERE al.charge_id=charges.id AND p.status='confirmed')").bind(reason,m.id,now(),c.id),database.prepare("INSERT INTO audit(id,actor,action,entity_id,created_at) SELECT ?,?,'charge_voided',?,? WHERE changes()=1").bind(crypto.randomUUID(),m.id,c.id,now())]);if(!result[0].meta.changes)fail(409,'Primero anula los pagos aplicados al cobro.');return {id:c.id};
 }
 if(method==='POST'&&path[0]==='exceptions'&&path.length===1){
  const a=await athlete(body.athleteId),start=date(body.startDate),end=date(body.endDate),reason=str(body.reason,'motivo',500),id=requestId(body.requestId);if(end<start)fail(400,'El vencimiento debe ser igual o posterior al inicio');
  await database.batch([database.prepare('INSERT OR IGNORE INTO exceptions(id,athlete_id,start_date,end_date,reason,created_by,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,a.id,start,end,reason,m.id,now()),database.prepare("INSERT OR IGNORE INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,'exception_created',?,?)").bind('exception:'+id,m.id,id,now())]);return {id};
 }
 if(method==='POST'&&path[0]==='exceptions'&&path[1]&&path[2]==='revoke'){await database.batch([database.prepare('UPDATE exceptions SET revoked_at=?,revoked_by=? WHERE id=? AND revoked_at IS NULL').bind(now(),m.id,path[1]),log(m,'exception_revoked',path[1])]);return {id:path[1]};}
 fail(404,'Operación económica no disponible');
}
