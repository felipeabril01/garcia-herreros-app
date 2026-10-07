import { db } from './db';
import { CLUB, CLUB_EMAIL, BOOTSTRAP_EMAIL, weeklySessions } from './config';
import { HttpError } from './errors';
import { financeHandle, enrichEligibility, ensureMonthlyCharges } from './finance';
import { setCredentials,validateUsername,verifyPasswordForStaff } from './auth';
import { ensureReviewedAthleteImport } from './reviewed-import';
export { HttpError } from './errors';
export type Identity={userId?:string,email?:string,staffId?:string};
const fail=(status:number,msg:string):never=>{throw new HttpError(status,msg)};
const now=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID();
export const ADMIN='admin';
export function coachCategories(id:string){return [...new Set(weeklySessions.filter(s=>s.coaches.includes(id)).map(s=>s.category))] as string[]}
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
function requireCategory(m:any,category:string){if(m.role!==ADMIN&&!coachCategories(m.coach_id||'').includes(category))fail(403,'No tienes asignada esta categoría.');}
function str(v:any,label:string,max=150,required=true){if(v===undefined||v===null){if(required)fail(400,'Falta '+label);return ''}if(typeof v!=='string')fail(400,'Dato inválido: '+label);const s=v.trim();if((required&&!s)||s.length>max)fail(400,'Revisa '+label);return s;}
function date(v:any,label:string){const s=str(v,label,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T12:00:00Z'))||new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s)fail(400,'Fecha inválida: '+label);return s;}
function bogotaDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function category(v:any){const c=str(v,'categoría');if(!CLUB.categories.includes(c))fail(400,'Categoría inválida');return c;}
function phone(v:any,label:string){const p=str(v,label,30);if(p.replace(/\D/g,'').length<7||!/^[+\d\s()-]+$/.test(p))fail(400,'Revisa '+label);return p;}
function email(v:any,required=false){const e=str(v,'correo',254,required).toLowerCase();if(e&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))fail(400,'Correo inválido');return e;}
function athleteValues(b:any){const dob=date(b.dob,'nacimiento');if(dob>bogotaDate()||dob<'1990-01-01')fail(400,'Revisa la fecha de nacimiento');const consentDate=date(b.consentDate,'autorización');if(consentDate>bogotaDate())fail(400,'La autorización no puede tener una fecha futura');if(b.consent!==true)fail(400,'Registra la autorización del acudiente antes de guardar.');if(!['Mensual','Por práctica'].includes(b.modality))fail(400,'Modalidad inválida');const docNumber=str(b.docNumber,'documento',40,false);return {name:str(b.name,'nombre',100),dob,category:category(b.category),doc_type:str(b.docType,'tipo de documento',30,false),doc_number:docNumber||null,address:str(b.address,'dirección',250,false),guardian:str(b.guardian,'acudiente',100),relationship:str(b.relationship,'parentesco',50),phone:phone(b.phone,'celular del acudiente'),email:email(b.email),emergency_name:str(b.emergencyName,'contacto de emergencia',100),emergency_relation:str(b.emergencyRelation,'parentesco de emergencia',50),emergency_phone:phone(b.emergencyPhone,'celular de emergencia'),health_notes:str(b.healthNotes,'observaciones',1500,false),modality:b.modality,consent:1,consent_date:consentDate};}
function publicAthlete(a:any,m:any){if(m.role===ADMIN)return a;const {doc_number,doc_type,address,email,consent,consent_date,created_by,...safe}=a;return safe;}
async function athleteFor(id:string,m:any){const a:any=await db().prepare('SELECT * FROM athletes WHERE id=?').bind(id).first();if(!a)fail(404,'Deportista no encontrado');requireCategory(m,a.category);return a;}
function sessionSpec(id:string,m:any){const split=id.indexOf('_');if(split<0)fail(400,'Sesión inválida');const d=date(id.slice(0,split),'sesión'),categoryId=id.slice(split+1);const day=new Date(d+'T12:00:00Z').getUTCDay();const s=weeklySessions.find(s=>s.category===categoryId&&s.day===day);if(!s)fail(400,'La sesión no corresponde al horario del club');if(m.role!==ADMIN&&!s.coaches.includes(m.coach_id))fail(403,'No estás asignado a esta sesión.');return {...s,date:d,id};}
export async function handle(method:string,path:string[],body:any,m:any){const database=db();
 if(path[0]==='finance')return financeHandle(method,path.slice(1),body,m);
 if(method==='GET'&&path[0]==='bootstrap'){
  await ensureReviewedAthleteImport();
  await ensureMonthlyCharges();
  const result=await database.prepare('SELECT * FROM athletes ORDER BY name').all();const extraCategories=[...new Set(result.results.map((a:any)=>a.category).filter((x:any)=>x&&!CLUB.categories.includes(x)))];const categories=m.role===ADMIN?[...CLUB.categories,...extraCategories]:coachCategories(m.coach_id);const staff=m.role===ADMIN?(await database.prepare('SELECT id,name,title,role,coach_id,email,username,active,owner,(password_hash IS NOT NULL) AS has_password FROM staff ORDER BY owner DESC,role,name').all()).results:[];
  const permitted=(m.role===ADMIN?result.results:result.results.filter((a:any)=>categories.includes(a.category))).map(a=>publicAthlete(a,m));
  return {member:{id:m.id,name:m.name,title:m.title,role:m.role,coachId:m.coach_id,owner:!!m.owner},clubEmail:CLUB_EMAIL,categories,athletes:await enrichEligibility(permitted),staff,schedule:weeklySessions.filter(s=>m.role===ADMIN||s.coaches.includes(m.coach_id))};
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
  const name=str(body.name,'nombre',100),dob=date(body.dob,'nacimiento');
  if(dob>bogotaDate()||dob<'1990-01-01')fail(400,'Revisa la fecha de nacimiento');
  const docType=str(body.docType,'tipo de documento',30,false),docNumber=str(body.docNumber,'documento',40,false);
  const cat=str(body.category,'categoría',30);
  if(![...CLUB.categories,'Por definir'].includes(cat))fail(400,'Categoría inválida');
  const existing:any=docNumber?await database.prepare('SELECT id FROM athletes WHERE doc_number=?').bind(docNumber).first():null;
  if(existing)return {id:existing.id,skipped:true};
  const time=now();
  await database.batch([
   database.prepare("INSERT INTO athletes(id,name,dob,category,doc_type,doc_number,address,guardian,relationship,phone,email,emergency_name,emergency_relation,emergency_phone,health_notes,modality,consent,consent_date,status,created_by,created_at,updated_at,version) VALUES (?,?,?,?,?,?, '', '', '', '', NULL, '', '', '', '', '', 0, '', 'incomplete', ?, ?, ?, 1)").bind(id,name,dob,cat,docType||null,docNumber||null,m.id,time,time),
   auditStmt(m.id,'athlete_preregistered',id)
  ]);
  return {id,status:'incomplete'};
 }
 if(path[0]==='athletes'&&method==='POST'&&path.length===1){requireAdmin(m);const v=athleteValues(body);const id=str(body.requestId,'identificador',36);if(!/^[0-9a-f-]{36}$/.test(id))fail(400,'Identificador inválido');const previous:any=await database.prepare('SELECT id,created_by FROM athletes WHERE id=?').bind(id).first();if(previous){if(previous.created_by!==m.id)fail(409,'Identificador no disponible');return {id};}const time=now();const keys=Object.keys(v);await database.batch([database.prepare(`INSERT INTO athletes(id,${keys.join(',')},status,created_by,created_at,updated_at,version) VALUES (${Array(keys.length+5).fill('?').join(',')},1)`).bind(id,...Object.values(v),'active',m.id,time,time),auditStmt(m.id,'athlete_created',id)]);return {id};}
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
 if(path[0]==='athletes'&&path[1]&&path.length===2&&method==='PUT'){requireAdmin(m);const a=await athleteFor(path[1],m);if(body.version!==a.version)fail(409,'La ficha cambió en otra sesión. Recarga antes de editar.');const v=athleteValues(body),keys=Object.keys(v),newStatus=a.status==='incomplete'?'active':a.status;const results=await database.batch([database.prepare(`UPDATE athletes SET ${keys.map(k=>k+'=?').join(',')},status=?,updated_at=?,version=version+1 WHERE id=? AND version=?`).bind(...Object.values(v),newStatus,now(),a.id,a.version),database.prepare('INSERT INTO audit(id,actor,action,entity_id,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(uid(),m.id,a.status==='incomplete'?'athlete_completed':'athlete_updated',a.id,now())]);if(!results[0].meta.changes)fail(409,'La ficha cambió. Recarga y vuelve a intentarlo.');return {id:a.id,status:newStatus};}
 if(path[0]==='athletes'&&path[1]&&path[2]==='measurements'){
  const a=await athleteFor(path[1],m);
  if(method==='GET')return {measurements:(await database.prepare('SELECT measurements.*,staff.name AS recorder FROM measurements LEFT JOIN staff ON staff.id=measurements.created_by WHERE athlete_id=? ORDER BY date DESC,created_at DESC').bind(a.id).all()).results};
  if(method==='POST'){const d=date(body.date,'medición');if(d>bogotaDate()||d<a.dob)fail(400,'Revisa la fecha de medición');const w=body.weight,h=body.height;if(typeof w!=='number'||typeof h!=='number'||!Number.isFinite(w)||!Number.isFinite(h)||w<1||w>300||h<40||h>250)fail(400,'Peso o estatura fuera del rango permitido');const id=str(body.requestId,'identificador',36);if(!/^[0-9a-f-]{36}$/.test(id))fail(400,'Identificador inválido');const previous:any=await database.prepare('SELECT id,created_by,athlete_id,bmi FROM measurements WHERE id=?').bind(id).first();if(previous){if(previous.created_by!==m.id||previous.athlete_id!==a.id)fail(409,'Identificador no disponible');return {id,bmi:previous.bmi};}const bmi=w/(h/100)**2;await database.batch([database.prepare('INSERT INTO measurements(id,athlete_id,date,weight,height,bmi,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,a.id,d,w,h,bmi,m.id,now()),auditStmt(m.id,'measurement_created',id)]);return {id,bmi};}
 }
 if(path[0]==='sessions'&&path[1]){const s=sessionSpec(path[1],m);const existing:any=await database.prepare('SELECT * FROM sessions WHERE id=?').bind(s.id).first();
  if(method==='GET')return {session:existing||{id:s.id,date:s.date,category:s.category,version:0,attendance_json:'{}',notes:'',status:'programada',attendance_saved:0}};
  if(method==='PUT'){if(body.version!==(existing?.version||0))fail(409,'Otro profesor actualizó la sesión. Recarga para ver sus cambios.');if(!['attendance','execution'].includes(body.operation))fail(400,'Operación inválida');let att=existing?.attendance_json||'{}',saved=existing?.attendance_saved||0,notes=existing?.notes||'',status=existing?.status||'programada';
   if(body.operation==='attendance'){if(!body.attendance||typeof body.attendance!=='object'||Array.isArray(body.attendance))fail(400,'Lista inválida');const ps=(await database.prepare("SELECT id FROM athletes WHERE category=? AND status='active'").bind(s.category).all()).results;const ids=ps.map((p:any)=>p.id);if(!ids.length)fail(400,'Aún no hay deportistas en esta categoría');if(Object.keys(body.attendance).length!==ids.length||ids.some(id=>!['presente','ausente','excusado','tarde'].includes(body.attendance[id])))fail(400,'Completa la lista actual de deportistas de esta categoría.');att=JSON.stringify(body.attendance);saved=1;}
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
