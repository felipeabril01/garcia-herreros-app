import { db } from './db';
import { CLUB, weeklySessions } from './config';
import { HttpError } from './errors';

const now=()=>new Date().toISOString();
const fail=(status:number,msg:string):never=>{throw new HttpError(status,msg)};
const clean=(v:any,label:string,max=120)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(400,'Revisa '+label);return v.trim()};

export async function ensureOrganizationTables(){
 const database=db();
 await database.prepare(`CREATE TABLE IF NOT EXISTS club_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
 )`).run();
 await database.prepare(`CREATE TABLE IF NOT EXISTS club_schedule (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  day INTEGER NOT NULL,
  venue_key TEXT NOT NULL DEFAULT '',
  venue_name TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  coaches_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
 )`).run();
 const count:any=await database.prepare('SELECT COUNT(*) AS n FROM club_categories').first();
 if(!Number(count?.n||0)){
  const t=now();
  await database.batch(CLUB.categories.map((name,i)=>database.prepare('INSERT INTO club_categories(id,name,active,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),name,1,i,t,t)));
 }
 const scheduleCount:any=await database.prepare('SELECT COUNT(*) AS n FROM club_schedule').first();
 if(!Number(scheduleCount?.n||0)){
  const t=now();
  await database.batch(weeklySessions.map(s=>database.prepare('INSERT INTO club_schedule(id,category,day,venue_key,venue_name,start_time,end_time,coaches_json,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)').bind(s.id,s.category,s.day,s.venue,CLUB.venues[s.venue as keyof typeof CLUB.venues]||s.venue,s.start,s.end,JSON.stringify(s.coaches),t,t)));
 }
}

export async function organizationSnapshot(){
 await ensureOrganizationTables();
 const database=db();
 const categories=(await database.prepare('SELECT id,name,active,sort_order FROM club_categories WHERE active=1 ORDER BY sort_order,name').all()).results as any[];
 const schedule=(await database.prepare('SELECT * FROM club_schedule WHERE active=1 ORDER BY day,start_time,category').all()).results as any[];
 const coaches=(await database.prepare("SELECT id,name,title,role,coach_id,active FROM staff WHERE coach_id IS NOT NULL ORDER BY name").all()).results as any[];
 return {
  categories:categories.map(c=>c.name),
  categoryRecords:categories,
  coaches:coaches.map(c=>({id:c.coach_id||c.id,staffId:c.id,name:c.name,title:c.title,active:!!c.active})),
  schedule:schedule.map(s=>({id:s.id,category:s.category,day:Number(s.day),venue:s.venue_key,venueName:s.venue_name,start:s.start_time,end:s.end_time,coaches:JSON.parse(s.coaches_json||'[]')}))
 };
}

export async function coachCategoriesDynamic(coachId:string){
 const org=await organizationSnapshot();
 return [...new Set(org.schedule.filter((s:any)=>s.coaches.includes(coachId)).map((s:any)=>s.category))] as string[];
}

export async function sessionSpecDynamic(id:string,m:any){
 const split=id.indexOf('_');if(split<0)fail(400,'Sesión inválida');
 const d=id.slice(0,split);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d))fail(400,'Sesión inválida');
 const categoryId=id.slice(split+1);
 const day=new Date(d+'T12:00:00Z').getUTCDay();
 const org=await organizationSnapshot();
 const s=org.schedule.find((x:any)=>x.category===categoryId&&x.day===day);
 if(!s)fail(400,'La sesión no corresponde al horario actual del club');
 if(m.role!=='admin'&&!s.coaches.includes(m.coach_id))fail(403,'No estás asignado a esta sesión.');
 return {...s,date:d,id};
}

export async function organizationHandle(method:string,path:string[],body:any,m:any){
 if(m.role!=='admin')fail(403,'Esta acción requiere un administrativo.');
 await ensureOrganizationTables();
 const database=db();
 if(method==='GET'&&path.length===0)return organizationSnapshot();

 if(path[0]==='categories'&&method==='POST'){
  const name=clean(body.name,'nombre de categoría',60);
  const exists:any=await database.prepare('SELECT id FROM club_categories WHERE lower(name)=lower(?)').bind(name).first();
  if(exists)fail(409,'Ya existe una categoría con ese nombre.');
  const max:any=await database.prepare('SELECT COALESCE(MAX(sort_order),-1) AS n FROM club_categories').first();
  const id=crypto.randomUUID(),t=now();
  await database.prepare('INSERT INTO club_categories(id,name,active,sort_order,created_at,updated_at) VALUES (?,?,1,?,?,?)').bind(id,name,Number(max?.n||0)+1,t,t).run();
  return {id,name};
 }

 if(path[0]==='categories'&&path[1]&&method==='PUT'){
  const row:any=await database.prepare('SELECT * FROM club_categories WHERE id=?').bind(path[1]).first();
  if(!row)fail(404,'Categoría no encontrada.');
  const name=clean(body.name,'nombre de categoría',60);
  const duplicate:any=await database.prepare('SELECT id FROM club_categories WHERE lower(name)=lower(?) AND id<>?').bind(name,row.id).first();
  if(duplicate)fail(409,'Ya existe una categoría con ese nombre.');
  const t=now();
  await database.batch([
   database.prepare('UPDATE club_categories SET name=?,updated_at=? WHERE id=?').bind(name,t,row.id),
   database.prepare('UPDATE club_schedule SET category=?,updated_at=? WHERE category=?').bind(name,t,row.name),
   database.prepare('UPDATE athletes SET category=?,updated_at=?,version=version+1 WHERE category=?').bind(name,t,row.name),
   database.prepare('UPDATE sessions SET category=? WHERE category=?').bind(name,row.name)
  ]);
  return {id:row.id,name};
 }

 if(path[0]==='coaches'&&method==='POST'){
  const name=clean(body.name,'nombre del entrenador',100);
  const title=typeof body.title==='string'&&body.title.trim()?body.title.trim():'Entrenador';
  const id='coach-'+crypto.randomUUID().slice(0,8),coachId=id;
  await database.prepare("INSERT INTO staff(id,name,title,role,coach_id,email,auth_id,active,owner) VALUES (?,?,?,'coach',?,NULL,NULL,1,0)").bind(id,name,title,coachId).run();
  return {id:coachId,name,title};
 }

 if(path[0]==='coaches'&&path[1]&&method==='PUT'){
  const row:any=await database.prepare('SELECT * FROM staff WHERE coach_id=?').bind(path[1]).first();
  if(!row)fail(404,'Entrenador no encontrado.');
  const name=clean(body.name,'nombre del entrenador',100);
  const title=typeof body.title==='string'&&body.title.trim()?body.title.trim():'Entrenador';
  await database.prepare('UPDATE staff SET name=?,title=? WHERE id=?').bind(name,title,row.id).run();
  return {id:path[1],name,title};
 }

 if(path[0]==='schedule'&&method==='POST'){
  const org=await organizationSnapshot();
  const category=clean(body.category,'categoría',60);
  if(!org.categories.includes(category))fail(400,'Categoría inválida.');
  const day=Number(body.day);if(!Number.isInteger(day)||day<0||day>6)fail(400,'Día inválido.');
  const duplicate:any=await database.prepare('SELECT id FROM club_schedule WHERE active=1 AND category=? AND day=? LIMIT 1').bind(category,day).first();
  if(duplicate)fail(409,'Esta categoría ya tiene un entrenamiento configurado para ese día. Edita el horario existente.');
  const start=clean(body.start,'hora de inicio',5),end=clean(body.end,'hora final',5);
  if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||end<=start)fail(400,'Revisa el horario.');
  const venueName=clean(body.venueName,'cancha o lugar',100);
  const coaches=Array.isArray(body.coaches)?body.coaches.filter((x:any)=>org.coaches.some((c:any)=>c.id===x)):[];
  if(!coaches.length)fail(400,'Selecciona al menos un entrenador.');
  const id=crypto.randomUUID(),t=now();
  await database.prepare("INSERT INTO club_schedule(id,category,day,venue_key,venue_name,start_time,end_time,coaches_json,active,created_at,updated_at) VALUES (?,?,?,'',?,?,?,?,1,?,?)").bind(id,category,day,venueName,start,end,JSON.stringify(coaches),t,t).run();
  return {id};
 }

 if(path[0]==='schedule'&&path[1]&&method==='PUT'){
  const row:any=await database.prepare('SELECT * FROM club_schedule WHERE id=?').bind(path[1]).first();
  if(!row)fail(404,'Horario no encontrado.');
  const org=await organizationSnapshot();
  const category=clean(body.category,'categoría',60);
  if(!org.categories.includes(category))fail(400,'Categoría inválida.');
  const day=Number(body.day);if(!Number.isInteger(day)||day<0||day>6)fail(400,'Día inválido.');
  const duplicate:any=await database.prepare('SELECT id FROM club_schedule WHERE active=1 AND category=? AND day=? AND id<>? LIMIT 1').bind(category,day,row.id).first();
  if(duplicate)fail(409,'Esta categoría ya tiene otro entrenamiento configurado para ese día. Edita ese horario o elige otro día.');
  const start=clean(body.start,'hora de inicio',5),end=clean(body.end,'hora final',5);
  if(!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end)||end<=start)fail(400,'Revisa el horario.');
  const venueName=clean(body.venueName,'cancha o lugar',100);
  const coaches=Array.isArray(body.coaches)?body.coaches.filter((x:any)=>org.coaches.some((c:any)=>c.id===x)):[];
  if(!coaches.length)fail(400,'Selecciona al menos un entrenador.');
  await database.prepare("UPDATE club_schedule SET category=?,day=?,venue_key='',venue_name=?,start_time=?,end_time=?,coaches_json=?,updated_at=? WHERE id=?").bind(category,day,venueName,start,end,JSON.stringify(coaches),now(),row.id).run();
  return {id:row.id};
 }
 if(path[0]==='schedule'&&path[1]&&method==='DELETE'){
  const row:any=await database.prepare('SELECT id FROM club_schedule WHERE id=? AND active=1').bind(path[1]).first();
  if(!row)fail(404,'Horario no encontrado.');
  await database.prepare('UPDATE club_schedule SET active=0,updated_at=? WHERE id=?').bind(now(),row.id).run();
  return {id:row.id,deleted:true};
 }


 return fail(404,'Operación de organización no disponible.');
}
