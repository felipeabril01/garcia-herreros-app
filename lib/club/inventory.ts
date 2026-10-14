import { db } from './db';
import { HttpError } from './errors';

const now=()=>new Date().toISOString();
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fail=(s:number,m:string):never=>{throw new HttpError(s,m)};
const str=(v:any,label:string,max=180)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(400,'Revisa '+label);return v.trim()};
const optional=(v:any,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
const positiveInt=(v:any,label:string,max=100000)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<=0||n>max)fail(400,'Revisa '+label);return n};
const money=(v:any,label:string)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>100000000)fail(400,'Revisa '+label);return n};
const date=(v:any)=>{const s=str(v,'fecha',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T12:00:00Z')))fail(400,'Fecha inválida');if(s>today())fail(400,'La fecha no puede ser futura');return s};

export async function ensureUniformInventoryTables(){
 const database=db();
 await database.prepare(`CREATE TABLE IF NOT EXISTS uniform_items(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  size TEXT NOT NULL,
  sale_price INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(name,size)
 )`).run();
 await database.prepare(`CREATE TABLE IF NOT EXISTS uniform_movements(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  item_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost INTEGER NOT NULL DEFAULT 0,
  supplier TEXT NOT NULL DEFAULT '',
  movement_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
 )`).run();
 await database.prepare('CREATE INDEX IF NOT EXISTS uniform_movements_item_idx ON uniform_movements(item_id,movement_date)').run();
}

async function snapshot(){
 const database=db();
 const items:any[]=(await database.prepare(`SELECT i.*,
   COALESCE(SUM(CASE WHEN m.kind='entry' THEN m.quantity WHEN m.kind='sale' THEN -m.quantity ELSE 0 END),0) AS stock,
   COALESCE(SUM(CASE WHEN m.kind='entry' THEN m.quantity*m.unit_cost ELSE 0 END),0) AS purchased_value,
   MAX(CASE WHEN m.kind='entry' THEN m.unit_cost ELSE NULL END) AS last_unit_cost
  FROM uniform_items i LEFT JOIN uniform_movements m ON m.item_id=i.id
  WHERE i.active=1 GROUP BY i.id ORDER BY i.name,i.size`).all()).results;
 const movements:any[]=(await database.prepare(`SELECT m.*,i.name,i.size,s.name AS recorder
  FROM uniform_movements m JOIN uniform_items i ON i.id=m.item_id
  LEFT JOIN staff s ON s.id=m.created_by
  ORDER BY m.movement_date DESC,m.id DESC LIMIT 300`).all()).results;
 return {items,movements};
}

export async function inventoryHandle(method:string,path:string[],body:any,m:any){
 await ensureUniformInventoryTables();
 if(m.role!=='admin')fail(403,'Esta acción requiere un administrativo.');
 const database=db();

 if(method==='GET'&&path.length===0)return snapshot();

 if(method==='POST'&&path[0]==='entries'){
  const requestId=str(body.requestId,'identificador',36);
  if(!/^[0-9a-f-]{36}$/.test(requestId))fail(400,'Identificador inválido');
  const name=str(body.name,'tipo de uniforme',100);
  const size=str(body.size,'talla',30);
  const quantity=positiveInt(body.quantity,'cantidad',10000);
  const unitCost=money(body.unitCost,'costo unitario');
  const salePrice=money(body.salePrice,'precio de venta');
  const supplier=optional(body.supplier,150);
  const movementDate=date(body.movementDate);
  const notes=optional(body.notes,600);
  const prior:any=await database.prepare('SELECT id FROM uniform_movements WHERE request_id=?').bind(requestId).first();
  if(prior)return {id:prior.id,...await snapshot()};
  let item:any=await database.prepare('SELECT * FROM uniform_items WHERE lower(name)=lower(?) AND lower(size)=lower(?) LIMIT 1').bind(name,size).first();
  const when=now();
  if(!item){
   const id=crypto.randomUUID();
   await database.prepare('INSERT INTO uniform_items(id,name,size,sale_price,active,created_by,created_at,updated_at) VALUES (?,?,?,?,1,?,?,?)').bind(id,name,size,salePrice,m.id,when,when).run();
   item={id,name,size,sale_price:salePrice};
  }else if(Number(item.sale_price)!==salePrice){
   await database.prepare('UPDATE uniform_items SET sale_price=?,updated_at=? WHERE id=?').bind(salePrice,when,item.id).run();
  }
  const res:any=await database.prepare(`INSERT INTO uniform_movements(request_id,item_id,kind,quantity,unit_cost,supplier,movement_date,notes,created_by,created_at)
   VALUES (?,?,'entry',?,?,?,?,?,?,?)`).bind(requestId,item.id,quantity,unitCost,supplier,movementDate,notes,m.id,when).run();
  await database.prepare("INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),m.id,'uniform_stock_entry',String(res.meta?.last_row_id||item.id),when).run();
  return {id:Number(res.meta?.last_row_id||0),...await snapshot()};
 }

 fail(404,'Ruta de inventario no encontrada');
}
