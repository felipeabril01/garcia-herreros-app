import { db } from './db';
import { HttpError } from './errors';

const now=()=>new Date().toISOString();
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fail=(s:number,m:string):never=>{throw new HttpError(s,m)};
const str=(v:any,label:string,max=180,required=true)=>{if(v===undefined||v===null){if(required)fail(400,'Falta '+label);return ''}if(typeof v!=='string')fail(400,'Revisa '+label);const s=v.trim();if((required&&!s)||s.length>max)fail(400,'Revisa '+label);return s};
const amount=(v:any)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<=0||n>1000000000)fail(400,'Ingresa un valor válido');return n};
const date=(v:any,label='fecha',allowFuture=false)=>{const s=str(v,label,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T12:00:00Z')))fail(400,'Fecha inválida: '+label);if(!allowFuture&&s>today())fail(400,'La fecha no puede ser futura');return s};

export async function ensureExpenseTables(){
 const database=db();
 await database.prepare(`CREATE TABLE IF NOT EXISTS suppliers(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  document TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
 )`).run();
 await database.prepare('CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_unique ON suppliers(lower(name))').run();
 await database.prepare(`CREATE TABLE IF NOT EXISTS expenses(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL,
  concept TEXT NOT NULL,
  amount INTEGER NOT NULL,
  supplier_id TEXT,
  supplier_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'paid',
  method TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
 )`).run();
 await database.prepare('CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date)').run();
 await database.prepare('CREATE INDEX IF NOT EXISTS expenses_supplier_idx ON expenses(supplier_id)').run();
}

async function snapshot(){
 const database=db();
 const suppliers=(await database.prepare("SELECT * FROM suppliers WHERE active=1 ORDER BY name").all()).results;
 const expenses=(await database.prepare(`SELECT e.*,s.name AS recorder
   FROM expenses e LEFT JOIN staff s ON s.id=e.created_by
   ORDER BY e.expense_date DESC,e.id DESC LIMIT 500`).all()).results;
 return {suppliers,expenses};
}

export async function expensesHandle(method:string,path:string[],body:any,m:any){
 await ensureExpenseTables();
 if(m.role!=='admin')fail(403,'Esta acción requiere un administrativo.');
 const database=db();

 if(method==='GET'&&path.length===0)return snapshot();

 if(method==='POST'&&path[0]==='suppliers'){
  const name=str(body.name,'nombre del proveedor',120);
  const document=str(body.document,'documento',50,false);
  const phone=str(body.phone,'teléfono',40,false);
  const email=str(body.email,'correo',180,false).toLowerCase();
  const notes=str(body.notes,'observación',500,false);
  const existing:any=await database.prepare('SELECT id FROM suppliers WHERE lower(name)=lower(?)').bind(name).first();
  if(existing)fail(409,'Ya existe un proveedor con ese nombre.');
  const id=crypto.randomUUID(),when=now();
  await database.prepare('INSERT INTO suppliers(id,name,document,phone,email,notes,active,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?,?)')
   .bind(id,name,document,phone,email,notes,m.id,when,when).run();
  await database.prepare("INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),m.id,'supplier_created',id,when).run();
  return {id,...await snapshot()};
 }

 if(method==='POST'&&path[0]==='expenses'){
  const requestId=str(body.requestId,'identificador',36);
  if(!/^[0-9a-f-]{36}$/.test(requestId))fail(400,'Identificador inválido');
  const expenseDate=date(body.expenseDate,'fecha del gasto');
  const category=str(body.category,'categoría',80);
  const concept=str(body.concept,'concepto',180);
  const value=amount(body.amount);
  const status=str(body.status,'estado',30);
  if(!['paid','pending'].includes(status))fail(400,'Estado inválido');
  const supplierId=str(body.supplierId,'proveedor',100,false);
  let supplierName='';
  if(supplierId){
   const supplier:any=await database.prepare('SELECT id,name FROM suppliers WHERE id=? AND active=1').bind(supplierId).first();
   if(!supplier)fail(400,'Proveedor inválido');
   supplierName=supplier.name;
  }
  let method='',reference='',dueDate:any=null;
  if(status==='paid'){
   method=str(body.method,'medio de pago',30);
   if(!['Efectivo','Transferencia'].includes(method))fail(400,'Medio de pago inválido');
   reference=str(body.reference,'referencia',150,false);
   if(method==='Transferencia'&&!reference)fail(400,'Registra la referencia de la transferencia.');
  }else{
   dueDate=date(body.dueDate,'fecha de vencimiento',true);
   if(dueDate<expenseDate)fail(400,'El vencimiento no puede ser anterior al gasto.');
  }
  const notes=str(body.notes,'observación',600,false);
  const prior:any=await database.prepare('SELECT id FROM expenses WHERE request_id=?').bind(requestId).first();
  if(prior)return {id:prior.id,...await snapshot()};
  const when=now();
  const res:any=await database.prepare(`INSERT INTO expenses(request_id,expense_date,category,concept,amount,supplier_id,supplier_name,status,method,reference,due_date,notes,created_by,created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(requestId,expenseDate,category,concept,value,supplierId||null,supplierName,status,method,reference,dueDate,notes,m.id,when).run();
  const id=String(res.meta?.last_row_id||'');
  await database.prepare("INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),m.id,'expense_created',id,when).run();
  return {id:Number(id),...await snapshot()};
 }

 if(method==='POST'&&path[0]==='expenses'&&path[1]&&path[2]==='pay'){
  const id=Number(path[1]);if(!Number.isSafeInteger(id)||id<=0)fail(400,'Gasto inválido');
  const exp:any=await database.prepare('SELECT * FROM expenses WHERE id=?').bind(id).first();
  if(!exp)fail(404,'Gasto no encontrado');
  if(exp.status==='paid')return {id,status:'paid',...await snapshot()};
  const methodValue=str(body.method,'medio de pago',30);
  if(!['Efectivo','Transferencia'].includes(methodValue))fail(400,'Medio de pago inválido');
  const reference=str(body.reference,'referencia',150,false);
  if(methodValue==='Transferencia'&&!reference)fail(400,'Registra la referencia de la transferencia.');
  const paidDate=date(body.paidDate,'fecha de pago');
  const when=now();
  await database.batch([
   database.prepare("UPDATE expenses SET status='paid',expense_date=?,method=?,reference=?,due_date=NULL WHERE id=?").bind(paidDate,methodValue,reference,id),
   database.prepare("INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),m.id,'expense_paid',String(id),when)
  ]);
  return {id,status:'paid',...await snapshot()};
 }

 fail(404,'Ruta de gastos no encontrada');
}
