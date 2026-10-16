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
  paid_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
 )`).run();
 try{await database.prepare('ALTER TABLE expenses ADD COLUMN paid_date TEXT').run()}catch{}
 await database.prepare(`CREATE TABLE IF NOT EXISTS expense_payments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL,
  request_id TEXT NOT NULL UNIQUE,
  payment_date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
 )`).run();
 await database.prepare('CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date)').run();
 await database.prepare('CREATE INDEX IF NOT EXISTS expenses_supplier_idx ON expenses(supplier_id)').run();
 await database.prepare('CREATE INDEX IF NOT EXISTS expense_payments_expense_idx ON expense_payments(expense_id)').run();
 await database.prepare('CREATE INDEX IF NOT EXISTS expense_payments_date_idx ON expense_payments(payment_date)').run();
}

async function snapshot(){
 const database=db();
 const suppliers=(await database.prepare("SELECT * FROM suppliers WHERE active=1 ORDER BY name").all()).results as any[];
 const expenses=(await database.prepare(`SELECT e.*,s.name AS recorder
   FROM expenses e LEFT JOIN staff s ON s.id=e.created_by
   ORDER BY e.expense_date DESC,e.id DESC LIMIT 500`).all()).results as any[];
 const payments=(await database.prepare(`SELECT p.*,e.concept,e.category,e.supplier_name,s.name AS recorder
   FROM expense_payments p
   JOIN expenses e ON e.id=p.expense_id
   LEFT JOIN staff s ON s.id=p.created_by
   ORDER BY p.payment_date DESC,p.id DESC LIMIT 2000`).all()).results as any[];
 const sums=new Map<number,number>(),counts=new Map<number,number>();
 for(const p of payments){
  const id=Number(p.expense_id);
  sums.set(id,(sums.get(id)||0)+Number(p.amount||0));
  counts.set(id,(counts.get(id)||0)+1);
 }
 const enriched=expenses.map((e:any)=>{
  const id=Number(e.id),paymentSum=sums.get(id)||0;
  const paidAmount=paymentSum>0?Math.min(Number(e.amount),paymentSum):(e.status==='paid'?Number(e.amount):0);
  const balance=Math.max(0,Number(e.amount)-paidAmount);
  const status=balance===0?'paid':paidAmount>0?'partial':'pending';
  return {...e,status,paid_amount:paidAmount,balance,payment_count:counts.get(id)||0};
 });
 return {suppliers,expenses:enriched,payments};
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

 if(method==='POST'&&path[0]==='expenses'&&path[1]&&path[2]==='pay'){
  const id=Number(path[1]);if(!Number.isSafeInteger(id)||id<=0)fail(400,'Gasto inválido');
  const requestId=str(body.requestId,'identificador',36);
  if(!/^[0-9a-f-]{36}$/.test(requestId))fail(400,'Identificador inválido');
  const prior:any=await database.prepare('SELECT id FROM expense_payments WHERE request_id=?').bind(requestId).first();
  if(prior)return {id,...await snapshot()};
  const exp:any=await database.prepare('SELECT * FROM expenses WHERE id=?').bind(id).first();
  if(!exp)fail(404,'Gasto no encontrado');
  const paidRow:any=await database.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM expense_payments WHERE expense_id=?').bind(id).first();
  const paidSoFar=Number(paidRow?.total||0);
  const legacyPaid=exp.status==='paid'&&paidSoFar===0?Number(exp.amount):paidSoFar;
  const balance=Math.max(0,Number(exp.amount)-legacyPaid);
  if(balance<=0)fail(409,'Este gasto ya está pagado completamente.');
  const value=amount(body.amount);
  if(value>balance)fail(400,'El abono no puede superar el saldo pendiente de '+balance+'.');
  const methodValue=str(body.method,'medio de pago',30);
  if(!['Efectivo','Transferencia'].includes(methodValue))fail(400,'Medio de pago inválido');
  const reference=str(body.reference,'referencia',150,false);
  if(methodValue==='Transferencia'&&!reference)fail(400,'Registra la referencia de la transferencia.');
  const paymentDate=date(body.paidDate,'fecha de pago');
  const finalPayment=value===balance,newStatus=finalPayment?'paid':'partial',when=now();
  const statements:any[]=[
   database.prepare('INSERT INTO expense_payments(expense_id,request_id,payment_date,amount,method,reference,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id,requestId,paymentDate,value,methodValue,reference,m.id,when),
   database.prepare("UPDATE expenses SET status=?,paid_date=?,method=?,reference=?,due_date=? WHERE id=?")
    .bind(newStatus,finalPayment?paymentDate:null,methodValue,reference,finalPayment?null:exp.due_date,id),
   database.prepare("INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)")
    .bind(crypto.randomUUID(),m.id,finalPayment?'expense_paid':'expense_payment_created',String(id),when)
  ];
  await database.batch(statements);
  return {id,status:newStatus,...await snapshot()};
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
  const res:any=await database.prepare(`INSERT INTO expenses(request_id,expense_date,category,concept,amount,supplier_id,supplier_name,status,method,reference,due_date,paid_date,notes,created_by,created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(requestId,expenseDate,category,concept,value,supplierId||null,supplierName,status,method,reference,dueDate,status==='paid'?expenseDate:null,notes,m.id,when).run();
  const id=Number(res.meta?.last_row_id||0);
  const statements:any[]=[
   database.prepare("INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),m.id,'expense_created',String(id),when)
  ];
  if(status==='paid'){
   statements.push(database.prepare('INSERT INTO expense_payments(expense_id,request_id,payment_date,amount,method,reference,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id,crypto.randomUUID(),expenseDate,value,method,reference,m.id,when));
  }
  await database.batch(statements);
  return {id,...await snapshot()};
 }

 fail(404,'Ruta de gastos no encontrada');
}
