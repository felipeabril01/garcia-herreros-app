import { db } from './db';
type Row=[string,string,string];
// id, first paid month 2026, last covered month 2026. 00 means scholarship.
const ROWS:Row[]=[["b62d1a93-3373-4c1c-b5c9-81fa5aea2bff","10","10"],["d5554123-3042-4988-8104-7280093371d8","06","10"],["2d1bf852-214b-4b30-87ff-3affe0db6cec","05","10"],["4341f642-553c-40e7-8f1b-80d10271526b","09","10"],["342a2027-4734-40c1-8a92-e17be4242cbf","01","10"],["2d41110a-6c1c-5bcd-a154-ff5bc2376a99","09","09"],["d45f6f4b-a2da-42d5-8543-449712a5ffc5","05","10"],["c273d0f8-eaba-51c4-a0d6-82e2717cfaae","09","10"],["poliza-1092551358","01","10"],["a4a112cf-64e1-51b7-a9d5-0e7a31628d35","08","10"],["c33b684f-8295-44a3-97df-e44ad298d1e7","04","10"],["ceaeab01-f5af-4c29-b24b-030031b1ff8f","04","10"],["c391a2c7-514b-4ba9-86cb-efa696a4c00f","04","10"],["c6ca4532-5afb-4771-8c03-eaaa81a9febc","01","10"],["9d2766cf-7db2-468b-b977-692f9e06797c","06","10"],["0a61821e-c9fc-4b2e-a080-9a7df5ccaaba","01","10"],["poliza-1093314201","02","09"],["f99c46cf-be83-554f-9914-1f18181819b9","08","10"],["5cbdb184-a39c-4549-b32d-977ca86dc384","01","10"],["596b6a52-9dec-4b7e-8b36-5d50b276071f","05","10"],["2746599e-c2d9-4d65-b985-6acf82bbb12d","02","10"],["20b61eac-fd5b-5288-bed9-020c5e3b6631","08","10"],["c2fafb24-c3b8-5495-89e4-3c7e3a7b5fd7","08","10"],["6ad8fc30-b42f-5393-8e38-08dc3b3e32c0","08","10"],["799c0c8c-502e-50c6-864d-41c4b1d77b40","08","10"],["176492fb-3449-417a-a13b-737a637880de","03","10"],["b9f028af-0236-526d-be40-abfdc22efe12","09","10"],["ab29699e-af7b-4346-9f7f-4ab14482a9bb","00","00"],["f567ba5e-f9c1-5443-a59d-ec4866635dbb","06","11"],["7af81604-4435-5722-8753-3dfa422eace0","06","11"],["poliza-1092023277","01","11"],["21289b33-f2ef-48bc-a3f4-7be0fecf646c","07","11"],["270a42bb-49a7-5abe-a5f8-767146d62a44","09","11"],["6862c409-ce06-4c3d-bfb5-d669b86eb005","11","11"],["poliza-1092967899","01","11"],["373fe338-d8b2-5aea-9412-51052374ceb6","09","10"],["b13e71a2-4551-5629-a048-c42863d8276c","08","10"],["2eca9f2f-402a-42fd-9074-c90cf2ec4321","01","10"]];
const targetCategory='2020–2021';
const juan='poliza-1093314201';
export async function ensureHistoricalTables(){
 const database=db();
 await database.prepare(`CREATE TABLE IF NOT EXISTS historical_credits(
  charge_id TEXT PRIMARY KEY, athlete_id TEXT NOT NULL, period TEXT NOT NULL,
  amount INTEGER NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL)`).run();
 await database.prepare(`CREATE TABLE IF NOT EXISTS legacy_billing_imports(
  athlete_id TEXT PRIMARY KEY, original_start_month TEXT, last_paid_month TEXT,
  source TEXT NOT NULL, created_at TEXT NOT NULL)`).run();
}
export async function historicalImportCount(){
 await ensureHistoricalTables();
 const row:any=await db().prepare("SELECT COUNT(*) AS n FROM legacy_billing_imports WHERE source='confirmed-excel-20261116-2020'").first();
 return Number(row?.n||0);
}
export async function migrateReviewed2020(m:any,ensureMonthlyCharges:()=>Promise<void>){
 if(m.role!=='admin')throw new Error('Solo administración puede importar cartera.');
 const database=db();
 await ensureHistoricalTables();
 const ids=ROWS.map(r=>r[0]);
 const existing:any[]=(await database.prepare('SELECT id,name,category,modality,status FROM athletes WHERE id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all()).results;
 const lookup=new Map(existing.map(a=>[a.id,a]));
 if(lookup.size!==38)throw new Error('Faltan deportistas en la base de datos. No se importó nada.');
 for(const [id,start,last] of ROWS){
  const a:any=lookup.get(id);
  if(id===juan){if(!['2008–2011',targetCategory].includes(a.category))throw new Error('La categoría de Juan David Rodríguez Serrano cambió. Revisar antes de importar.');}
  else if(a.category!==targetCategory)throw new Error('Categoría diferente para '+a.name+'. No se importó nada.');
  if(a.status!=='active'&&a.status!=='incomplete')throw new Error('Revisar deportista desactivado: '+a.name);
  if(start==='00'){if(a.modality!=='Beca')throw new Error('La beca de Vaiolet debe confirmarse en la app.');}
  else if(a.modality!=='Mensual'||!['09','10','11'].includes(last))throw new Error('Modalidad o mes incompatible: '+a.name);
 }
 const already=await historicalImportCount();
 // Reconciliation is idempotent, including recovery after an interrupted batch.
 // All data is prepared before any monetary mutations. Re-running is safe.
 const t=new Date().toISOString();
 const statements:any[]=[];
 statements.push(database.prepare("UPDATE athletes SET category=?,updated_at=?,version=version+1 WHERE id=? AND category='2008–2011'").bind(targetCategory,t,juan));
 for(const [id,start,last] of ROWS){
  const scholarship=start==='00';
  statements.push(database.prepare('INSERT OR IGNORE INTO legacy_billing_imports(athlete_id,original_start_month,last_paid_month,source,created_at) VALUES (?,?,?,?,?)').bind(id,scholarship?null:'2026-'+start,scholarship?null:'2026-'+last,'confirmed-excel-20261116-2020',t));
  if(scholarship)continue;
  const billStart=start==='11'?'2026-11':'2026-10';
  statements.push(database.prepare('INSERT OR IGNORE INTO billing(athlete_id,start_month,annual_start_year,created_by,created_at) VALUES (?,?,?,?,?)').bind(id,billStart,2027,m.id,t));
  for(const period of ['2026-10','2026-11']){
   if(period<billStart)continue;
   const covered=period<='2026-'+last;
   const chargeId='mensualidad:'+id+':'+period;
   statements.push(database.prepare("INSERT OR IGNORE INTO charges(id,athlete_id,kind,period,amount,source,notes,status,created_by,created_at) VALUES (?,?,'mensualidad',?,50000,'cartulina',?,'active',?,?)").bind(chargeId,id,period,covered?'Mes cubierto según cartulina confirmada':'Mensualidad pendiente según cartulina confirmada',m.id,t));
  }
 }
 for(let i=0;i<statements.length;i+=60)await database.batch(statements.slice(i,i+60));
 // Match payments already recorded, so historical confirmation only settles the unpaid difference.
 const credits:any[]=[];
 for(const [id,start,last] of ROWS){
  if(start==='00')continue;
  for(const period of ['2026-10','2026-11']){
   if(period<'2026-'+start||period>'2026-'+last)continue;
   const chargeId='mensualidad:'+id+':'+period;
   credits.push(database.prepare(`INSERT OR IGNORE INTO historical_credits(charge_id,athlete_id,period,amount,source,created_at)
     SELECT c.id,c.athlete_id,c.period,c.amount-COALESCE((
       SELECT SUM(al.amount) FROM allocations al JOIN payments p ON p.id=al.payment_id
       WHERE al.charge_id=c.id AND p.status='confirmed'),0),
       'cartulina-confirmada',?
     FROM charges c WHERE c.id=? AND c.status='active'
     AND c.amount>COALESCE((SELECT SUM(al.amount) FROM allocations al JOIN payments p ON p.id=al.payment_id
       WHERE al.charge_id=c.id AND p.status='confirmed'),0)`).bind(t,chargeId));
  }
 }
 for(let i=0;i<credits.length;i+=60)await database.batch(credits.slice(i,i+60));
 await ensureMonthlyCharges();
 return {imported:await historicalImportCount(),historicalCredits:credits.length,already:false};
}
