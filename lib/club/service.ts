import { db } from './db';
import { CLUB, CLUB_EMAIL, BOOTSTRAP_EMAIL, weeklySessions } from './config';
import { HttpError } from './errors';
import { financeHandle, enrichEligibility, ensureMonthlyCharges } from './finance';
import { setCredentials,validateUsername,verifyPasswordForStaff } from './auth';
import { ensureReviewedAthleteImport } from './reviewed-import';
import { ensureReviewedAthleteImport20261009 } from './reviewed-import-20261009';
import { ensureReviewedAthleteImport20261013 } from './reviewed-import-20261013';
import { payrollHandle, ensureCoachPaymentsTable } from './payroll';
import { inventoryHandle, ensureUniformInventoryTables } from './inventory';
import { expensesHandle, ensureExpenseTables } from './expenses';
import { organizationHandle, ensureOrganizationTables, organizationSnapshot, coachCategoriesDynamic, sessionSpecDynamic } from './organization';
export { HttpError } from './errors';
export type Identity={userId?:string,email?:string,staffId?:string};
const fail=(status:number,msg:string):never=>{throw new HttpError(status,msg)};
const now=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID();
export const ADMIN='admin';
export async function coachCategories(id:string){return coachCategoriesDynamic(id)}
function auditStmt(actor:string,action:string,id:string){return db().prepare('INSERT INTO audit (id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)').bind(uid(),actor,action,id,now())}
export async function member(identity:Identity){
 const database=db();
 let row:any=null;
 if(identity.staffId){
  row=await database.prepare('SELECT * FROM staff WHERE id=? AND active=1').bind(identity.staffId).first();
 }else if(identity.email&&identity.userId){
  // Transitional Cloudflare Access binding, used only while the owner creates local credentials.
  if(identity.email.toLowerCase()===BOOTSTRAP_EMAIL){
   await database.prepare("INSERT OR IGNORE INTO staff(id,name,title,role,coach_id,email,auth_id,active,owner) VALUES ('felipe','Felipe Abril','Coordinador y entrenador','admin','felipe',?,?,1,1)").bind(BOOTSTRAP_EMAIL,identity.userId).run();
  }
  row=await database.prepare('SELECT * FROM staff WHERE auth_id=? AND active=1').bind(identity.userId).first();
  if(!row){await database.prepare('UPDATE staff SET auth_id=? WHERE email=? AND auth_id IS NULL AND active=1 AND owner=0').bind(identity.userId,identity.email.toLowerCase()).run();row=await database.prepare('SELECT * FROM staff WHERE auth_id=? AND active=1').bind(identity.userId).first();}
 }
 if(!row)fail(403,'Tu cuenta todavía no tiene acceso asignado al club. Contacta al coordinador.');
 if(row.owner){const entries=[{id:'presidente',name:'Vicente Sánchez',title:'Presidente',role:'admin',coach:null},{id:'vicepresidenta',name:'Por definir',title:'Vicepresidenta',role:'admin',coach:null},{id:'secretaria',name:'Sandra González',title:'Secretaria',role:'admin',coach:null},...CLUB.coaches.filter(c=>c.id!=='felipe').map(c=>({id:c.id,name:c.name,title:'Entrenador',role:'coach',coach:c.id}))];await database.batch(entries.map(e=>database.prepare('INSERT OR IGNORE INTO staff(id,name,title,role,coach_id,email,auth_id,active,owner) VALUES (?,?,?,?,?,NULL,NULL,1,0)').bind(e.id,e.name,e.title,e.role,e.coach)));}
 return row;
}
function requireAdmin(m:any){if(m.role!==ADMIN)fail(403,'Esta acción requiere un administrativo.');}
async function requireCategory(m:any,category:string){if(m.role!==ADMIN&&!(await coachCategoriesDynamic(m.coach_id||'')).includes(category))fail(403,'No tienes asignada esta categoría.');}
function str(v:any,label:string,max=150,required=true){if(v===undefined||v===null){if(required)fail(400,'Falta '+label);return ''}if(typeof v!=='string')fail(400,'Dato inválido: '+label);const s=v.trim();if((required&&!s)||s.length>max)fail(400,'Revisa '+label);return s;}
function date(v:any,label:string){const s=str(v,label,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T12:00:00Z'))||new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s)fail(400,'Fecha inválida: '+label);return s;}
function bogotaDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function category(v:any,allowed:string[]=CLUB.categories){const c=str(v,'categoría');if(!allowed.includes(c))fail(400,'Categoría inválida');return c;}
function phone(v:any,label:string,required=true){const p=str(v,label,30,required);if(p&&(p.replace(/\D/g,'').length<7||!/^[+\d\s()-]+$/.test(p)))fail(400,'Revisa '+label);return p;}
function email(v:any,required=false){const e=str(v,'correo',254,required).toLowerCase();if(e&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))fail(400,'Correo inválido');return e;}
function athleteValues(b:any,allowedCategories:string[]=CLUB.categories){const dob=date(b.dob,'nacimiento');if(dob>bogotaDate()||dob<'1990-01-01')fail(400,'Revisa la fecha de nacimiento');const consentDate=date(b.consentDate,'autorización');if(consentDate>bogotaDate())fail(400,'La autorización no puede tener una fecha futura');if(b.consent!==true)fail(400,'Registra la autorización del acudiente antes de guardar.');const docNumber=str(b.docNumber,'documento',40,false);return {name:str(b.name,'nombre',100),dob,category:category(b.category,allowedCategories),doc_type:str(b.docType,'tipo de documento',30,false),doc_number:docNumber||null,address:str(b.address,'dirección',250,false),guardian:str(b.guardian,'acudiente',100),relationship:str(b.relationship,'parentesco',50),phone:phone(b.phone,'celular del acudiente'),email:email(b.email,true),emergency_name:str(b.emergencyName,'contacto de emergencia',100,false),emergency_relation:str(b.emergencyRelation,'parentesco de emergencia',50,false),emergency_phone:phone(b.emergencyPhone,'celular de emergencia',false),health_notes:str(b.healthNotes,'observaciones',1500,false),modality:(()=>{const v=str(b.modality,'modalidad',30);if(!['Mensual','Por práctica','Beca'].includes(v))fail(400,'Modalidad inválida');return v;})(),consent:1,consent_date:consentDate};}
function partialAthleteValues(b:any,allowedCategories:string[]=CLUB.categories){
 const name=str(b.name,'nombre',100);
 const cat=category(b.category,[...allowedCategories,'Por definir']);
 const dob=b.dob?date(b.dob,'nacimiento'):'';
 if(dob&&(dob>bogotaDate()||dob<'1990-01-01'))fail(400,'Revisa la fecha de nacimiento');
 const docNumber=str(b.docNumber,'documento',40,false);
 const modality=str(b.modality,'modalidad',30,false);
 if(modality&&!['Mensual','Por práctica','Beca'].includes(modality))fail(400,'Modalidad inválida');
 const consent=b.consent===true;
 const consentDate=consent?date(b.consentDate,'autorización'):'';
 if(consentDate>bogotaDate())fail(400,'La autorización no puede tener una fecha futura');
 return {name,dob,category:cat,doc_type:str(b.docType,'tipo de documento',30,false)||null,doc_number:docNumber||null,
  address:str(b.address,'dirección',250,false),guardian:str(b.guardian,'acudiente',100,false),
  relationship:str(b.relationship,'parentesco',50,false),phone:phone(b.phone,'celular del acudiente',false),
  email:email(b.email,false)||null,emergency_name:str(b.emergencyName,'contacto de emergencia',100,false),
  emergency_relation:str(b.emergencyRelation,'parentesco de emergencia',50,false),
  emergency_phone:phone(b.emergencyPhone,'celular de emergencia',false),
  health_notes:str(b.healthNotes,'observaciones',1500,false),modality,consent:consent?1:0,consent_date:consentDate};
}
function registrationNeeds(a:any){
 const needs:string[]=[];
 if(!String(a.dob||'').trim())needs.push('fecha de nacimiento');
 if(a.category==='Por definir')needs.push('categoría');
 if(!String(a.guardian||'').trim())needs.push('nombre del acudiente');
 if(!String(a.relationship||'').trim())needs.push('parentesco');
 if(!String(a.phone||'').trim())needs.push('celular del acudiente');
 if(!String(a.email||'').trim())needs.push('correo electrónico');
 if(!String(a.modality||'').trim())needs.push('modalidad');
 if(!a.consent||!String(a.consent_date||'').trim())needs.push('autorización del acudiente');
 return needs;
}
function publicAthlete(a:any,m:any){
 const registration_missing=registrationNeeds(a);
 if(m.role===ADMIN)return {...a,registration_missing};
 const {doc_number,doc_type,address,email,consent,consent_date,created_by,...safe}=a;
 return {...safe,registration_missing};
}
async function athleteFor(id:string,m:any){const a:any=await db().prepare('SELECT * FROM athletes WHERE id=?').bind(id).first();if(!a)fail(404,'Deportista no encontrado');await requireCategory(m,a.category);return a;}
async function sessionSpec(id:string,m:any){return sessionSpecDynamic(id,m)}
export async function handle(method:string,path:string[],body:any,m:any){const database=db();
 if(path[0]==='finance')return financeHandle(method,path.slice(1),body,m);
 if(path[0]==='payroll')return payrollHandle(method,path.slice(1),body,m);
 if(path[0]==='inventory')return inventoryHandle(method,path.slice(1),body,m);
 if(path[0]==='expenses')return expensesHandle(method,path.slice(1),body,m);
 if(path[0]==='organization')return organizationHandle(method,path.slice(1),body,m);
 if(method==='GET'&&path[0]==='bootstrap'){
  await ensureReviewedAthleteImport();
  await ensureReviewedAthleteImport20261009();
  await ensureReviewedAthleteImport20261013();
  await ensureCoachPaymentsTable();
  await ensureUniformInventoryTables();
  await ensureExpenseTables();
  await ensureOrganizationTables();
  try{await database.prepare('ALTER TABLE athletes ADD COLUMN internal_note TEXT').run()}catch{}
  await database.prepare("UPDATE athletes SET modality='Mensual',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),version=version+1 WHERE modality IS NULL OR trim(modality)=''").run();
  await ensureMonthlyCharges();
  const org=await organizationSnapshot();const result=await database.prepare('SELECT * FROM athletes ORDER BY name').all();const extraCategories=[...new Set(result.results.map((a:any)=>a.category).filter((x:any)=>x&&!org.categories.includes(x)))];const categories=m.role===ADMIN?[...org.categories,...extraCategories]:await coachCategoriesDynamic(m.coach_id||'');const staff=m.role===ADMIN?(await database.prepare('SELECT id,name,title,role,coach_id,email,username,active,owner,(password_hash IS NOT NULL) AS has_password FROM staff ORDER BY owner DESC,role,name').all()).results:[];
  const permitted=(m.role===ADMIN?result.results:result.results.filter((a:any)=>categories.includes(a.category))).map(a=>publicAthlete(a,m));
  return {member:{id:m.id,name:m.name,title:m.title,role:m.role,coachId:m.coach_id,owner:!!m.owner},clubEmail:CLUB_EMAIL,categories,athletes:await enrichEligibility(permitted),staff,coaches:org.coaches,schedule:org.schedule.filter((s:any)=>m.role===ADMIN||s.coaches.includes(m.coach_id)),categoryRecords:org.categoryRecords};
 }
 if(path[0]==='account'&&path[1]==='password'&&method==='PUT'){
  const current=str(body.currentPassword,'contraseña actual',128);
  const next=str(body.newPassword,'nueva contraseña',128);
  const confirm=str(body.confirmPassword,'confirmación',128);
  if(next!==confirm)fail(400,'Las contraseñas nuevas no coinciden.');
  if(!(await verifyPasswordForStaff(m.id,current)))fail(400,'La contraseña actual no es correcta.');
  try{await setCredentials(m.id,m.username,next);}
  catch(err){fail(400,err instanceof Error?err.message:'Revisa la nueva contraseña');}
  await auditStmt(m.id,'password_changed',m.id).run();
  return {ok:true};
 }
 if(path[0]==='athletes'&&path[1]==='preregister'&&method==='POST'){
  requireAdmin(m);
  const id=str(body.requestId,'identificador',36);
  if(!/^[0-9a-f-]{36}$/.test(id))fail(400,'Identificador inválido');
  const previous:any=await database.prepare('SELECT id,created_by FROM athletes WHERE id=?').bind(id).first();
  if(previous){if(previous.created_by!==m.id)fail(409,'Identificador no disponible');return {id,status:'incomplete'};}
  const org=await organizationSnapshot();
  const v=partialAthleteValues(body,org.categories);
  const duplicated:any=await database.prepare("SELECT id FROM athletes WHERE lower(trim(name))=lower(?) AND category=? LIMIT 1").bind(v.name,v.category).first();
  if(duplicated)fail(409,'Ya existe una ficha con ese nombre y categoría. Búscala antes de registrar otra.');
  if(v.doc_number){
   const sameDoc:any=await database.prepare('SELECT id FROM athletes WHERE doc_number=? LIMIT 1').bind(v.doc_number).first();
   if(sameDoc)fail(409,'Ya existe una ficha con ese número de documento.');
  }
  const time=now(),keys=Object.keys(v);
  await database.batch([
   database.prepare(`INSERT INTO athletes(id,${keys.join(',')},status,created_by,created_at,updated_at,version) VALUES (${Array(keys.length+5).fill('?').join(',')},1)`).bind(id,...Object.values(v),'incomplete',m.id,time,time),
   auditStmt(m.id,'athlete_preregistered',id)
  ]);
  return {id,status:'incomplete'};
 }
 if(path[0]==='athletes'&&path[1]&&path[2]==='preregister'&&method==='PUT'){
  requireAdmin(m);
  const a:any=await athleteFor(path[1],m);
  if(a.status!=='incomplete')fail(409,'Esta ficha ya está activa o inactiva. Utiliza Editar ficha.');
  if(body.version!==a.version)fail(409,'La ficha cambió en otra sesión. Recarga antes de editar.');
  const org=await organizationSnapshot();
  const v=partialAthleteValues(body,org.categories);
  const duplicated:any=await database.prepare("SELECT id FROM athletes WHERE lower(trim(name))=lower(?) AND category=? AND id<>? LIMIT 1").bind(v.name,v.category,a.id).first();
  if(duplicated)fail(409,'Ya existe otra ficha con ese nombre y categoría.');
  if(v.doc_number){
   const sameDoc:any=await database.prepare('SELECT id FROM athletes WHERE doc_number=? AND id<>? LIMIT 1').bind(v.doc_number,a.id).first();
   if(sameDoc)fail(409,'Ya existe otra ficha con ese número de documento.');
  }
  const keys=Object.keys(v);
  const r=await database.batch([
   database.prepare(`UPDATE athletes SET ${keys.map(k=>k+'=?').join(',')},updated_at=?,version=version+1 WHERE id=? AND version=?`).bind(...Object.values(v),now(),a.id,a.version),
   database.prepare('INSERT INTO audit(id,actor,action,entity_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(uid(),m.id,'athlete_preregister_updated',a.id,now())
  ]);
  if(!r[0].meta.changes)fail(409,'La ficha cambió. Recarga y vuelve a intentarlo.');
  return {id:a.id,status:'incomplete'};
 }
 if(path[0]==='athletes'&&method==='POST'&&path.length===1){requireAdmin(m);const org=await organizationSnapshot();const v=athleteValues(body,org.categories);const id=str(body.requestId,'identificador',36);if(!/^[0-9a-f-]{36}$/.test(id))fail(400,'Identificador inválido');const previous:any=await database.prepare('SELECT id,created_by FROM athletes WHERE id=?').bind(id).first();if(previous){if(previous.created_by!==m.id)fail(409,'Identificador no disponible');return {id};}const time=now();const keys=Object.keys(v);await database.batch([database.prepare(`INSERT INTO athletes(id,${keys.join(',')},status,created_by,created_at,updated_at,version) VALUES (${Array(keys.length+5).fill('?').join(',')},1)`).bind(id,...Object.values(v),'active',m.id,time,time),auditStmt(m.id,'athlete_created',id)]);return {id};}
 if(path[0]==='athletes'&&path[1]&&path[2]==='note'&&method==='PUT'){
  const a:any=await athleteFor(path[1],m);
  const note=str(body.note,'nota interna',700,false);
  const time=now();
  await database.batch([
   database.prepare('UPDATE athletes SET internal_note=?,updated_at=?,version=version+1 WHERE id=?').bind(note||null,time,a.id),
   auditStmt(m.id,note?'athlete_internal_note_updated':'athlete_internal_note_cleared',a.id)
  ]);
  return {id:a.id,note};
 }
 if(path[0]==='athletes'&&path[1]&&path[2]==='status'&&method==='PUT'){
  requireAdmin(m);
  const a:any=await athleteFor(path[1],m);
  const status=body?.status;
  if(!['active','inactive'].includes(status))fail(400,'Estado inválido');
  if(status===a.status)return {id:a.id,status};
  await database.batch([
    database.prepare('UPDATE athletes SET status=?,updated_at=?,version=version+1 WHERE id=?').bind(status,now(),a.id),
    auditStmt(m.id,status==='inactive'?'athlete_deactivated':'athlete_reactivated',a.id)
  ]);
  return {id:a.id,status};
 }
 if(path[0]==='athletes'&&path[1]&&path[2]==='advanced-delete'&&method==='POST'){
  if(!m.owner)fail(403,'Solo el responsable principal puede usar la eliminación avanzada.');
  const a:any=await athleteFor(path[1],m);
  if(body?.confirmText!=='ELIMINAR DEFINITIVAMENTE')fail(400,'Confirmación inválida.');
  const rows:any[]=(await database.prepare('SELECT id,attendance_json FROM sessions WHERE attendance_json LIKE ?').bind('%'+a.id+'%').all()).results as any[];
  const updates:any[]=[];
  for(const row of rows){
   try{
    const att=JSON.parse(row.attendance_json||'{}');
    if(Object.prototype.hasOwnProperty.call(att,a.id)){
     delete att[a.id];
     updates.push(database.prepare('UPDATE sessions SET attendance_json=?,version=version+1 WHERE id=?').bind(JSON.stringify(att),row.id));
    }
   }catch{}
  }
  for(let i=0;i<updates.length;i+=40)await database.batch(updates.slice(i,i+40));
  await database.batch([
   database.prepare('DELETE FROM allocations WHERE payment_id IN (SELECT id FROM payments WHERE athlete_id=?)').bind(a.id),
   database.prepare('DELETE FROM payments WHERE athlete_id=?').bind(a.id),
   database.prepare('DELETE FROM exceptions WHERE athlete_id=?').bind(a.id),
   database.prepare('DELETE FROM billing WHERE athlete_id=?').bind(a.id),
   database.prepare('DELETE FROM charges WHERE athlete_id=?').bind(a.id),
   database.prepare('DELETE FROM measurements WHERE athlete_id=?').bind(a.id),
   database.prepare("DELETE FROM uniform_movements WHERE athlete_id=? AND kind='sale'").bind(a.id),
   database.prepare('DELETE FROM athletes WHERE id=?').bind(a.id),
   auditStmt(m.id,'athlete_advanced_deleted',a.id)
  ]);
  return {id:a.id,deleted:true};
 }

 if(path[0]==='athletes'&&path[1]&&path.length===2&&method==='DELETE'){
  requireAdmin(m);
  const a:any=await athleteFor(path[1],m);
  const [measurements,payments,charges,billing,exceptions,sessions]=await Promise.all([
    database.prepare('SELECT COUNT(*) AS n FROM measurements WHERE athlete_id=?').bind(a.id).first(),
    database.prepare('SELECT COUNT(*) AS n FROM payments WHERE athlete_id=?').bind(a.id).first(),
    database.prepare('SELECT COUNT(*) AS n FROM charges WHERE athlete_id=?').bind(a.id).first(),
    database.prepare('SELECT COUNT(*) AS n FROM billing WHERE athlete_id=?').bind(a.id).first(),
    database.prepare('SELECT COUNT(*) AS n FROM exceptions WHERE athlete_id=?').bind(a.id).first(),
    database.prepare('SELECT COUNT(*) AS n FROM sessions WHERE attendance_json LIKE ?').bind('%'+a.id+'%').first()
  ]);
  const refs=[measurements,payments,charges,billing,exceptions,sessions].reduce((n:any,r:any)=>n+Number((r as any)?.n||0),0);
  if(refs>0)fail(409,'Esta ficha ya tiene historial, asistencia o movimientos financieros. Desactívala en lugar de eliminarla.');
  await database.batch([
    database.prepare('DELETE FROM athletes WHERE id=?').bind(a.id),
    auditStmt(m.id,'athlete_deleted',a.id)
  ]);
  return {id:a.id,deleted:true};
 }
 if(path[0]==='athletes'&&path[1]&&path.length===2&&method==='PUT'){requireAdmin(m);const a=await athleteFor(path[1],m);if(body.version!==a.version)fail(409,'La ficha cambió en otra sesión. Recarga antes de editar.');const org=await organizationSnapshot();const v=athleteValues(body,org.categories),keys=Object.keys(v),newStatus=a.status==='incomplete'?'active':a.status;const results=await database.batch([database.prepare(`UPDATE athletes SET ${keys.map(k=>k+'=?').join(',')},status=?,updated_at=?,version=version+1 WHERE id=? AND version=?`).bind(...Object.values(v),newStatus,now(),a.id,a.version),database.prepare('INSERT INTO audit(id,actor,action,entity_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(uid(),m.id,a.status==='incomplete'?'athlete_completed':'athlete_updated',a.id,now())]);if(!results[0].meta.changes)fail(409,'La ficha cambió. Recarga y vuelve a intentarlo.');return {id:a.id,status:newStatus};}
 if(path[0]==='athletes'&&path[1]&&path[2]==='measurements'){
  const a=await athleteFor(path[1],m);
  if(method==='GET')return {measurements:(await database.prepare('SELECT measurements.*,staff.name AS recorder FROM measurements LEFT JOIN staff ON staff.id=measurements.created_by WHERE athlete_id=? ORDER BY date DESC,created_at DESC').bind(a.id).all()).results};
  if(method==='POST'){const d=date(body.date,'medición');if(d>bogotaDate()||d<a.dob)fail(400,'Revisa la fecha de medición');const w=body.weight,h=body.height;if(typeof w!=='number'||typeof h!=='number'||!Number.isFinite(w)||!Number.isFinite(h)||w<1||w>300||h<40||h>250)fail(400,'Peso o estatura fuera del rango permitido');const id=str(body.requestId,'identificador',36);if(!/^[0-9a-f-]{36}$/.test(id))fail(400,'Identificador inválido');const previous:any=await database.prepare('SELECT id,created_by,athlete_id,bmi FROM measurements WHERE id=?').bind(id).first();if(previous){if(previous.created_by!==m.id||previous.athlete_id!==a.id)fail(409,'Identificador no disponible');return {id,bmi:previous.bmi};}const bmi=w/(h/100)**2;await database.batch([database.prepare('INSERT INTO measurements(id,athlete_id,date,weight,height,bmi,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,a.id,d,w,h,bmi,m.id,now()),auditStmt(m.id,'measurement_created',id)]);return {id,bmi};}
 }
 if(path[0]==='sessions'&&path[1]==='history'&&method==='GET'){
  const rows:any[]=(await database.prepare("SELECT sessions.*,staff.name AS updated_by_name FROM sessions LEFT JOIN staff ON staff.id=sessions.updated_by WHERE attendance_saved=1 OR status<>'programada' OR trim(notes)<>'' ORDER BY date DESC,updated_at DESC LIMIT 300").all()).results as any[];
  const coachCats=m.role===ADMIN?[]:await coachCategoriesDynamic(m.coach_id||'');const allowed=m.role===ADMIN?rows:rows.filter((r:any)=>coachCats.includes(r.category));
  return {sessions:allowed};
 }
 if(path[0]==='sessions'&&path[1]){const s=await sessionSpec(path[1],m);const existing:any=await database.prepare('SELECT * FROM sessions WHERE id=?').bind(s.id).first();
  if(method==='GET')return {session:existing||{id:s.id,date:s.date,category:s.category,version:0,attendance_json:'{}',notes:'',status:'programada',attendance_saved:0}};
  if(method==='PUT'){if(body.version!==(existing?.version||0))fail(409,'Otro profesor actualizó la sesión. Recarga para ver sus cambios.');if(!['attendance','execution'].includes(body.operation))fail(400,'Operación inválida');let att=existing?.attendance_json||'{}',saved=existing?.attendance_saved||0,notes=existing?.notes||'',status=existing?.status||'programada';
   if(body.operation==='attendance'){if(!body.attendance||typeof body.attendance!=='object'||Array.isArray(body.attendance))fail(400,'Lista inválida');const ps=(await database.prepare("SELECT id FROM athletes WHERE category=? AND status='active'").bind(s.category).all()).results;const ids=ps.map((p:any)=>p.id);if(!ids.length)fail(400,'Aún no hay deportistas en esta categoría');if(Object.keys(body.attendance).length!==ids.length)fail(400,'Completa la lista actual de deportistas de esta categoría.');const normalized:any={};for(const id of ids){const entry=body.attendance[id],status=typeof entry==='string'?entry:entry?.status,note=typeof entry==='object'&&entry?str(entry.note??'','nota de asistencia',250,false):'';if(!['presente','ausente','excusado','tarde'].includes(status))fail(400,'Completa la lista actual de deportistas de esta categoría.');normalized[id]={status,note};}att=JSON.stringify(normalized);saved=1;}
   else{notes=str(body.notes,'observaciones',3000,false);if(!['programada','realizada','cancelada'].includes(body.status))fail(400,'Estado inválido');status=body.status;}
   const statement=existing?database.prepare('UPDATE sessions SET attendance_json=?,attendance_saved=?,notes=?,status=?,updated_by=?,updated_at=?,version=version+1 WHERE id=? AND version=?').bind(att,saved,notes,status,m.id,now(),s.id,existing.version):database.prepare('INSERT OR IGNORE INTO sessions(id,date,category,attendance_json,attendance_saved,notes,status,updated_by,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,1)').bind(s.id,s.date,s.category,att,saved,notes,status,m.id,now());
   const results=await database.batch([statement,database.prepare('INSERT INTO audit(id,actor,action,entity_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(uid(),m.id,body.operation==='attendance'?'attendance_saved':'session_updated',s.id,now())]);if(!results[0].meta.changes)fail(409,'La sesión cambió en otra ventana. Recarga antes de guardar.');return {id:s.id,version:(existing?.version||0)+1};
  }
 }
 if(path[0]==='staff'&&path[1]&&method==='PUT'){
  if(!m.owner)fail(403,'Solo el responsable inicial puede configurar accesos.');
  const s:any=await database.prepare('SELECT * FROM staff WHERE id=?').bind(path[1]).first();
  if(!s||s.owner)fail(400,'No se puede modificar esta cuenta');
  const e=email(body.email,false),name=str(body.name,'nombre',100);
  if(typeof body.active!=='boolean')fail(400,'Estado inválido');
  let username='';
  try{username=validateUsername(str(body.username,'usuario',40));}
  catch(err){fail(400,err instanceof Error?err.message:'Revisa el usuario');}
  const duplicate:any=await database.prepare('SELECT id FROM staff WHERE username=? AND id<>?').bind(username,s.id).first();
  if(duplicate)fail(409,'Ese nombre de usuario ya está asignado.');
  if(body.password){
   try{await setCredentials(s.id,username,String(body.password),true);}
   catch(err){fail(400,err instanceof Error?err.message:'Revisa la contraseña');}
  }else if(!s.password_hash)fail(400,'Define una contraseña inicial para este usuario.');
  await database.prepare('UPDATE staff SET name=?,email=?,username=?,active=? WHERE id=?').bind(name,e||null,username,body.active?1:0,s.id).run();
  if(body.password&&s.password_hash)await auditStmt(m.id,'password_reset_admin',s.id).run();
  await auditStmt(m.id,'staff_access_updated',s.id).run();
  return {id:s.id};
 }
 if(path[0]==='audit'&&method==='GET'){requireAdmin(m);return {events:(await database.prepare('SELECT audit.*,staff.name AS actor_name FROM audit LEFT JOIN staff ON audit.actor=staff.id ORDER BY created_at DESC LIMIT 30').all()).results};}
 fail(404,'Operación no disponible');
}
