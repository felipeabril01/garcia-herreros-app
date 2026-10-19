'use strict';
const accountingToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let accountingReport=null,accountingStart=accountingToday().slice(0,7)+'-01',accountingEnd=accountingToday(),accountingSection='summary',accountingSummary=null;
function accountingPage(){setTimeout(()=>{renderAccountingSection()},0);return title('CONTABILIDAD','Control financiero del club.','Consulta ingresos, pagos a entrenadores, uniformes, gastos y proveedores.')+`
<div class="card" style="padding:10px 12px;margin-bottom:16px">
 <div class="form-actions" style="justify-content:flex-start;margin:0;gap:8px">
  <button type="button" class="btn ${accountingSection==='summary'?'primary':''}" onclick="switchAccountingSection('summary')">Resumen general</button>
  <button type="button" class="btn ${accountingSection==='income'?'primary':''}" onclick="switchAccountingSection('income')">Ingresos</button>
  <button type="button" class="btn ${accountingSection==='coach'?'primary':''}" onclick="switchAccountingSection('coach')">Pagos a entrenadores</button>
  <button type="button" class="btn ${accountingSection==='uniforms'?'primary':''}" onclick="switchAccountingSection('uniforms')">Uniformes e inventario</button>
  <button type="button" class="btn ${accountingSection==='expenses'?'primary':''}" onclick="switchAccountingSection('expenses')">Gastos y proveedores</button>
 </div>
</div>
<div id="accounting-section"></div>`}

function switchAccountingSection(section){
 accountingSection=section;
 renderAccountingSection();
}
function renderAccountingSection(){
 const el=document.querySelector('#accounting-section');if(!el)return;
 if(accountingSection==='summary'){
  el.innerHTML=`<section class="card" style="padding:18px">
   <div class="card-head" style="margin-bottom:12px"><div><h2>Resumen contable general</h2><p>Ingresos, egresos y saldo neto del periodo.</p></div><button type="button" class="btn primary" onclick="loadAccountingSummary(true)">Actualizar resumen</button></div>
   <div class="form-grid" style="margin-bottom:0">
    ${field('Desde','summaryStart',accountingStart,'date')}
    ${field('Hasta','summaryEnd',accountingEnd,'date')}
   </div>
  </section><div id="accounting-summary-content" aria-live="polite">Cargando resumen…</div>`;
  loadAccountingSummary();return;
 }
 if(accountingSection==='coach'){
  el.innerHTML='<div id="coach-payments-content">Cargando pagos a entrenadores…</div>';
  loadCoachPayments();return;
 }
 if(accountingSection==='uniforms'){
  el.innerHTML='<div id="uniform-inventory-content">Cargando inventario…</div>';
  loadUniformInventory();return;
 }
 if(accountingSection==='expenses'){
  el.innerHTML='<div id="expenses-content">Cargando gastos…</div>';
  loadExpenses();return;
 }
 el.innerHTML=`<section class="card" style="padding:18px">
  <div class="card-head" style="margin-bottom:12px"><div><h2>Reporte de ingresos</h2><p>Selecciona el periodo a consultar.</p></div><button type="button" class="btn primary" onclick="loadAccountingReport(true)">Generar reporte</button></div>
  <div class="form-grid" style="margin-bottom:0">
   ${field('Desde','accountingStart',accountingStart,'date')}
   ${field('Hasta','accountingEnd',accountingEnd,'date')}
  </div>
 </section>
 <div id="accounting-content" aria-live="polite">Cargando ingresos…</div>`;
 loadAccountingReport();
}
async function loadAccountingReport(fromForm=false){
 const el=document.querySelector('#accounting-content');if(!el)return;
 if(fromForm){accountingStart=document.querySelector('[name=accountingStart]')?.value||accountingStart;accountingEnd=document.querySelector('[name=accountingEnd]')?.value||accountingEnd;}
 el.innerHTML='<p>Cargando reporte…</p>';
 try{accountingReport=await api('finance/reports/income','POST',{startDate:accountingStart,endDate:accountingEnd});paintAccountingReport()}catch(e){el.innerHTML=errorBox(e.message)}
}
function accountingKindLabel(k){return {mensualidad:'Mensualidades',inscripcion:'Inscripciones',practica:'Prácticas',uniforme:'Uniformes'}[k]||k}
function paintAccountingReport(){
 const el=document.querySelector('#accounting-content'),r=accountingReport;if(!el||!r)return;
 const cash=r.methods.find(x=>x.method==='Efectivo')?.total||0,transfer=r.methods.find(x=>x.method==='Transferencia')?.total||0;
 el.innerHTML=`
 <div class="card-head" style="margin-bottom:14px"><div><h2>Resumen del periodo</h2><p>${dateText(r.startDate)} al ${dateText(r.endDate)}</p></div><button type="button" class="btn" onclick="printAccountingIncomeReport()">Generar PDF / Imprimir</button></div>
 <div class="stats">
  ${stat('Ingresos del periodo',money(r.total),r.count+' pagos confirmados','wallet')}
  ${stat('Efectivo',money(cash),'Recibido en efectivo','wallet')}
  ${stat('Transferencias',money(transfer),'Pagos verificados','check')}
 </div>
 <div class="dashboard-grid">
  <section class="card"><div class="card-head"><h2>Por concepto</h2></div>
   ${r.concepts.map(x=>`<div class="info-row"><strong>${esc(accountingKindLabel(x.kind))}</strong><strong>${money(x.total)}</strong></div>`).join('')||'<div class="empty">Sin ingresos en el periodo.</div>'}
  </section>
  <section class="card"><div class="card-head"><h2>Por categoría</h2></div>
   ${r.categories.map(x=>`<div class="info-row"><div><strong>${esc(x.category)}</strong><small>${x.count} pagos</small></div><strong>${money(x.total)}</strong></div>`).join('')||'<div class="empty">Sin ingresos en el periodo.</div>'}
  </section>
 </div>
 <section class="card"><div class="card-head"><div><h2>Detalle de ingresos</h2><p>${dateText(r.startDate)} al ${dateText(r.endDate)}</p></div><span class="badge ok">${r.count} movimientos</span></div>
  <div class="table-wrap"><table class="roster-table"><thead><tr><th>Fecha</th><th>Deportista</th><th>Concepto</th><th>Medio</th><th>Valor</th><th>Comprobante</th></tr></thead><tbody>
  ${r.payments.map(p=>`<tr><td>${dateText(p.paid_date)}</td><td><strong>${esc(p.athlete_name)}</strong><br><span class="muted">${esc(p.category||'')}</span></td><td>${esc(p.concepts||'Pago')}</td><td>${esc(p.method)}</td><td><strong>${money(p.amount)}</strong></td><td>${p.source==='uniform'?'<span class="muted">Venta de uniforme</span>':'<button class="btn link" onclick="receiptView('+p.id+')">Ver '+p.id+'</button>'}</td></tr>`).join('')}
  </tbody></table></div>
  ${!r.payments.length?'<div class="empty">No hay pagos confirmados para estas fechas.</div>':''}
 </section>`;
}


function printAccountingIncomeReport(){
 const r=accountingReport;if(!r)return toast('Primero genera el reporte de ingresos.');
 const cash=r.methods.find(x=>x.method==='Efectivo')?.total||0;
 const transfer=r.methods.find(x=>x.method==='Transferencia')?.total||0;
 const generated=dateText(accountingToday());
 const concepts=r.concepts.map(x=>'<tr><td>'+esc(accountingKindLabel(x.kind))+'</td><td>'+money(x.total)+'</td></tr>').join('');
 const categories=r.categories.map(x=>'<tr><td>'+esc(x.category)+'</td><td>'+x.count+'</td><td>'+money(x.total)+'</td></tr>').join('');
 const details=r.payments.map(p=>'<tr><td>'+dateText(p.paid_date)+'</td><td>'+esc(p.athlete_name)+'</td><td>'+esc(p.category||'')+'</td><td>'+esc(p.concepts||'Pago')+'</td><td>'+esc(p.method)+'</td><td>'+money(p.amount)+'</td></tr>').join('');
 const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de ingresos García Herreros FC</title><style>'+
 '*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#14254b;margin:0;background:#fff}.page{max-width:980px;margin:0 auto;padding:28px}.top{border-top:7px solid #124bdf;padding-top:20px;display:flex;align-items:center;gap:18px;border-bottom:1px solid #dbe3f0;padding-bottom:18px}.top img{width:72px;height:90px;object-fit:contain}.club{font-size:23px;font-weight:800}.sub{color:#596a85;font-size:12px;margin-top:5px}.head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin:24px 0}.head h1{margin:0;font-size:24px;color:#124bdf}.period{font-size:13px;color:#596a85;margin-top:7px}.stamp{border:1px solid #167052;color:#167052;padding:8px 11px;font-size:11px;font-weight:700}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}.stat{background:#f4f7fc;border:1px solid #dbe3f0;padding:15px}.stat small{display:block;color:#596a85;font-weight:700;font-size:11px;text-transform:uppercase}.stat strong{display:block;font-size:21px;margin-top:7px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:18px 0}.box{border:1px solid #dbe3f0;padding:14px}.box h2,.detail h2{font-size:15px;margin:0 0 12px}.tbl{width:100%;border-collapse:collapse;font-size:11px}.tbl th{background:#14254b;color:#fff;text-align:left;padding:8px}.tbl td{border-bottom:1px solid #e2e8f0;padding:8px;vertical-align:top}.tbl td:last-child,.tbl th:last-child{text-align:right}.detail{margin-top:20px}.foot{margin-top:28px;border-top:1px solid #dbe3f0;padding-top:14px;text-align:center;color:#596a85;font-size:10px}@media print{@page{size:A4 landscape;margin:10mm}.page{max-width:none;padding:0}.no-print{display:none!important}.detail table{font-size:9px}.detail tr{break-inside:avoid}.detail thead{display:table-header-group}}'+
 '</style></head><body><div class="page"><div class="top"><img src="/escudo.jpeg" alt="Escudo"><div><div class="club">GARCÍA HERREROS FC</div><div class="sub">CLUB DE FÚTBOL · INFORME FINANCIERO INTERNO</div></div></div>'+
 '<div class="head"><div><h1>INFORME DE INGRESOS</h1><div class="period">Periodo: '+dateText(r.startDate)+' al '+dateText(r.endDate)+' · Generado: '+generated+'</div></div><div class="stamp">'+r.count+' PAGOS CONFIRMADOS</div></div>'+
 '<div class="stats"><div class="stat"><small>Ingresos del periodo</small><strong>'+money(r.total)+'</strong></div><div class="stat"><small>Efectivo</small><strong>'+money(cash)+'</strong></div><div class="stat"><small>Transferencias</small><strong>'+money(transfer)+'</strong></div></div>'+
 '<div class="grid"><div class="box"><h2>Ingresos por concepto</h2><table class="tbl"><thead><tr><th>Concepto</th><th>Total</th></tr></thead><tbody>'+concepts+'</tbody></table></div><div class="box"><h2>Ingresos por categoría</h2><table class="tbl"><thead><tr><th>Categoría</th><th>Pagos</th><th>Total</th></tr></thead><tbody>'+categories+'</tbody></table></div></div>'+
 '<div class="detail"><h2>Detalle de movimientos</h2><table class="tbl"><thead><tr><th>Fecha</th><th>Deportista</th><th>Categoría</th><th>Concepto</th><th>Medio</th><th>Valor</th></tr></thead><tbody>'+details+'</tbody></table></div>'+
 '<div class="foot">García Herreros FC · Constancia interna de ingresos registrados en la aplicación.</div></div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>';
 const w=window.open('','_blank');
 if(!w)return toast('El navegador bloqueó la ventana del reporte. Permite ventanas emergentes e inténtalo de nuevo.');
 try{w.opener=null}catch{}
 w.document.open();w.document.write(html);w.document.close();
}


let coachPayments=[],coachFilter='Todos',coachPeriod='',coachStatus='Todos';
async function loadCoachPayments(){
 const el=document.querySelector('#coach-payments-content');if(!el)return;
 try{const r=await api('payroll');coachPayments=r.payments||[];paintCoachPayments()}catch(e){el.innerHTML=errorBox(e.message)}
}
function coachPaymentStatus(p){return p.status==='confirmed'?'<span class="badge ok">Recibido confirmado</span>':'<span class="badge warn">Pendiente de confirmación</span>'}
function paintCoachPayments(){
 const el=document.querySelector('#coach-payments-content');if(!el)return;
 const coaches=[...new Map(coachPayments.map(p=>[p.coach_id,p.coach_name])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'es'));
 const filtered=coachPayments.filter(p=>(coachFilter==='Todos'||p.coach_id===coachFilter)&&(!coachPeriod||p.period===coachPeriod)&&(coachStatus==='Todos'||p.status===coachStatus));
 const pending=filtered.filter(p=>p.status==='pending_confirmation').length;
 const total=filtered.reduce((s,p)=>s+Number(p.amount||0),0);
 el.innerHTML=`
 <section class="card">
  <div class="card-head"><div><h2>Pagos a entrenadores</h2><p>Registra pagos, filtra el historial y genera comprobantes o reportes.</p></div><div class="actions"><button class="btn" onclick="printCoachPaymentsReport()">Generar reporte</button><button class="btn primary" onclick="coachPaymentForm()">Registrar pago</button></div></div>
  <div class="finance-tools" style="margin-bottom:14px">
   <select class="filter" aria-label="Filtrar por entrenador" onchange="coachFilter=this.value;paintCoachPayments()"><option value="Todos">Todos los entrenadores</option>${coaches.map(([id,name])=>'<option value="'+esc(id)+'" '+(coachFilter===id?'selected':'')+'>'+esc(name)+'</option>').join('')}</select>
   <input class="filter" aria-label="Filtrar por periodo" type="month" value="${esc(coachPeriod)}" onchange="coachPeriod=this.value;paintCoachPayments()">
   <select class="filter" aria-label="Filtrar por estado" onchange="coachStatus=this.value;paintCoachPayments()"><option value="Todos" ${coachStatus==='Todos'?'selected':''}>Todos los estados</option><option value="pending_confirmation" ${coachStatus==='pending_confirmation'?'selected':''}>Pendiente de confirmación</option><option value="confirmed" ${coachStatus==='confirmed'?'selected':''}>Recibido confirmado</option></select>
   <button type="button" class="btn link" onclick="coachFilter='Todos';coachPeriod='';coachStatus='Todos';paintCoachPayments()">Limpiar filtros</button>
  </div>
  <div class="stats">
   ${stat('Pagos mostrados',filtered.length,'Según los filtros','wallet')}
   ${stat('Pendientes de confirmar',pending,'Requieren confirmación del entrenador','clock')}
   ${stat('Total mostrado',money(total),'Pagos a entrenadores','check')}
  </div>
  <div class="table-wrap"><table class="roster-table"><thead><tr><th>Fecha</th><th>Entrenador</th><th>Periodo</th><th>Concepto</th><th>Medio</th><th>Valor</th><th>Estado</th><th>Comprobante</th></tr></thead><tbody>
   ${filtered.map(p=>`<tr><td>${dateText(p.paid_date)}</td><td><strong>${esc(p.coach_name)}</strong></td><td>${esc(p.period)}</td><td>${esc(p.concept)}${p.notes?'<br><span class="muted">'+esc(p.notes)+'</span>':''}</td><td>${esc(p.method)}${p.reference?'<br><span class="muted">Ref. '+esc(p.reference)+'</span>':''}</td><td><strong>${money(p.amount)}</strong></td><td>${coachPaymentStatus(p)}${p.confirmed_at?'<br><span class="muted">'+new Date(p.confirmed_at).toLocaleString('es-CO',{timeZone:'America/Bogota'})+'</span>':''}</td><td><button class="btn link" onclick="printCoachPaymentReceipt(${p.id})">Ver / imprimir</button></td></tr>`).join('')||'<tr><td colspan="8"><div class="empty">No hay pagos con estos filtros.</div></td></tr>'}
  </tbody></table></div>
 </section>`;
}
function coachPaymentForm(){
 const coaches=(state.staff||[]).filter(s=>s.active&&s.coach_id);
 if(!coaches.length)return toast('No hay entrenadores activos configurados.');
 const token=crypto.randomUUID();
 const period=accountingToday().slice(0,7);
 showModal('Registrar pago a entrenador',`
  <p class="sub" style="margin-bottom:18px">El pago quedará pendiente hasta que el entrenador confirme que lo recibió desde su cuenta.</p>
  <form id="coach-payment-form"><div class="form-grid">
   <label class="field full">Entrenador<select name="coachId">${coaches.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc(s.title)+'</option>').join('')}</select></label>
   <label class="field">Periodo<input name="period" type="month" value="${period}" required></label>
   ${field('Valor','amount','','number',true,false,12)}
   ${field('Concepto','concept','Pago de entrenamiento','text',true,true,120)}
   <label class="field">Medio de pago<select name="method"><option>Efectivo</option><option>Transferencia</option></select></label>
   ${field('Referencia (si es transferencia)','reference','','text',false,false,150)}
   ${field('Fecha del pago','paidDate',accountingToday(),'date')}
   <label class="field full">Observación (opcional)<textarea name="notes" rows="3" maxlength="600"></textarea></label>
   <label class="field full consent-check"><input type="checkbox" name="confirmed" required>Confirmo que este pago ya fue realizado al entrenador.</label>
  </div><div id="coach-payment-error"></div><div class="form-actions"><button type="button" class="btn" onclick="modal.close()">Cancelar</button><button class="btn primary" type="submit">Registrar pago</button></div></form>`);
 document.querySelector('#coach-payment-form').onsubmit=async e=>{
  e.preventDefault();const form=e.target,btn=form.querySelector('[type=submit]');btn.disabled=true;
  const d=Object.fromEntries(new FormData(form));d.amount=Number(d.amount);d.confirmed=d.confirmed==='on';d.requestId=token;
  try{await api('payroll','POST',d);modal.close();await loadCoachPayments();toast('Pago registrado. Queda pendiente la confirmación del entrenador.')}
  catch(err){document.querySelector('#coach-payment-error').innerHTML=errorBox(err.message);btn.disabled=false}
 };
}
async function loadMyCoachPayments(){
 const el=document.querySelector('#my-coach-payments');if(!el)return;
 try{
  const r=await api('payroll');const mine=(r.payments||[]).filter(p=>p.coach_id===state.member.id);
  window.myCoachPayments=mine;
  const pending=mine.filter(p=>p.status==='pending_confirmation');
  el.innerHTML=`<section class="card">${pending.length?'<div class="notice" style="margin-bottom:18px"><strong>'+pending.length+' pago'+(pending.length===1?'':'s')+' pendiente'+(pending.length===1?'':'s')+' de confirmar</strong><br><span>Revisa el valor y confirma únicamente cuando hayas recibido el dinero.</span></div>':''}<div class="card-head"><div><h2>Mis pagos del club</h2><p>Historial de pagos registrados a tu nombre.</p></div></div>${mine.length?'<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Periodo</th><th>Concepto</th><th>Valor</th><th>Estado</th><th></th></tr></thead><tbody>'+mine.map(p=>'<tr><td>'+dateText(p.paid_date)+'</td><td>'+esc(p.period)+'</td><td>'+esc(p.concept)+'</td><td><strong>'+money(p.amount)+'</strong></td><td>'+coachPaymentStatus(p)+'</td><td>'+(p.status==='pending_confirmation'?'<button class="btn primary" onclick="confirmCoachPayment('+p.id+')">Confirmar recibido</button>':'')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">No tienes pagos registrados todavía.</div>'}</section>`;
 }catch(e){el.innerHTML=errorBox(e.message)}
}
function confirmCoachPayment(id){
 const p=(window.myCoachPayments||[]).find(x=>Number(x.id)===Number(id));if(!p)return toast('No se encontró el pago.');
 showModal('Confirmar pago recibido',`<div class="notice neutral" style="margin-bottom:18px">Esta confirmación quedará registrada con tu usuario, fecha y hora.</div><div class="detail-grid"><div class="detail"><small>Entrenador</small>${esc(p.coach_name)}</div><div class="detail"><small>Periodo</small>${esc(p.period)}</div><div class="detail"><small>Fecha del pago</small>${dateText(p.paid_date)}</div><div class="detail"><small>Valor</small><strong>${money(p.amount)}</strong></div><div class="detail full-width"><small>Concepto</small>${esc(p.concept)}</div><div class="detail"><small>Medio</small>${esc(p.method)}</div>${p.reference?'<div class="detail"><small>Referencia</small>'+esc(p.reference)+'</div>':''}</div><div class="form-actions"><button type="button" class="btn" onclick="modal.close()">Cancelar</button><button type="button" class="btn primary" onclick="submitCoachPaymentConfirmation(${p.id})">Sí, confirmar recibido</button></div>`);
}
async function submitCoachPaymentConfirmation(id){
 const btn=document.querySelector('#modal-content .btn.primary');if(btn)btn.disabled=true;
 try{await api('payroll/'+id+'/confirm','POST',{confirmed:true});modal.close();await loadMyCoachPayments();toast('Pago confirmado como recibido.')}
 catch(e){toast(e.message);if(btn)btn.disabled=false}
}

function coachPaymentPrintWindow(titleText,body){
 const w=window.open('','_blank');if(!w)return toast('El navegador bloqueó la ventana. Permite ventanas emergentes e inténtalo de nuevo.');
 try{w.opener=null}catch{}
 const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><title>'+esc(titleText)+'</title><style>'+
 '*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#14254b;margin:0;background:#fff}.page{max-width:900px;margin:0 auto;padding:28px}.top{border-top:7px solid #124bdf;padding-top:18px;display:flex;align-items:center;gap:18px;border-bottom:1px solid #dbe3f0;padding-bottom:18px}.top img{width:70px;height:88px;object-fit:contain}.club{font-size:22px;font-weight:800}.sub{font-size:12px;color:#596a85;margin-top:5px}.head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin:24px 0}.head h1{font-size:23px;color:#124bdf;margin:0}.label{display:block;font-size:10px;color:#596a85;text-transform:uppercase;font-weight:700;margin-bottom:4px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f4f7fc;border:1px solid #dbe3f0;padding:16px}.cell strong{display:block;font-size:14px}.total{margin-top:18px;background:#edf3ff;border-bottom:3px solid #124bdf;padding:16px;display:flex;justify-content:space-between;align-items:center}.total strong{font-size:25px}.status{border:1px solid #167052;color:#167052;padding:7px 10px;font-size:11px;font-weight:700}.status.pending{border-color:#b7791f;color:#b7791f}.tbl{width:100%;border-collapse:collapse;font-size:10px;margin-top:14px}.tbl th{background:#14254b;color:#fff;text-align:left;padding:8px}.tbl td{padding:8px;border-bottom:1px solid #e2e8f0}.tbl td:last-child,.tbl th:last-child{text-align:right}.foot{margin-top:24px;border-top:1px solid #dbe3f0;padding-top:12px;text-align:center;font-size:10px;color:#596a85}@media print{@page{size:A4 portrait;margin:12mm}.page{max-width:none;padding:0}}'+
 '</style></head><body><div class="page"><div class="top"><img src="/escudo.jpeg" alt="Escudo"><div><div class="club">GARCÍA HERREROS FC</div><div class="sub">CLUB DE FÚTBOL · CONTROL INTERNO</div></div></div>'+body+'<div class="foot">García Herreros FC · Constancia interna generada desde la aplicación.</div></div><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>';
 w.document.open();w.document.write(html);w.document.close();
}
function printCoachPaymentReceipt(id){
 const p=coachPayments.find(x=>Number(x.id)===Number(id));if(!p)return toast('No se encontró el pago.');
 const confirmed=p.status==='confirmed',status=confirmed?'RECIBIDO CONFIRMADO':'PENDIENTE DE CONFIRMACIÓN';
 const body='<div class="head"><div><span class="label">COMPROBANTE DE PAGO A ENTRENADOR</span><h1>GH-PROF-'+String(p.id).padStart(5,'0')+'</h1></div><span class="status '+(confirmed?'':'pending')+'">'+status+'</span></div>'+
 '<div class="grid"><div class="cell"><span class="label">ENTRENADOR</span><strong>'+esc(p.coach_name)+'</strong></div><div class="cell"><span class="label">PERIODO</span><strong>'+esc(p.period)+'</strong></div><div class="cell"><span class="label">FECHA DEL PAGO</span><strong>'+dateText(p.paid_date)+'</strong></div><div class="cell"><span class="label">MEDIO</span><strong>'+esc(p.method)+(p.reference?' · Ref. '+esc(p.reference):'')+'</strong></div><div class="cell"><span class="label">CONCEPTO</span><strong>'+esc(p.concept)+'</strong></div><div class="cell"><span class="label">REGISTRADO POR</span><strong>'+esc(p.recorder||'Administración')+'</strong></div>'+(p.notes?'<div class="cell" style="grid-column:1/-1"><span class="label">OBSERVACIÓN</span><strong>'+esc(p.notes)+'</strong></div>':'')+'</div>'+
 '<div class="total"><span><span class="label">VALOR PAGADO</span>Pesos colombianos · COP</span><strong>'+money(p.amount)+'</strong></div>'+
 (confirmed?'<div class="grid" style="margin-top:18px"><div class="cell"><span class="label">CONFIRMADO POR</span><strong>'+esc(p.confirmer||p.coach_name)+'</strong></div><div class="cell"><span class="label">FECHA Y HORA DE CONFIRMACIÓN</span><strong>'+new Date(p.confirmed_at).toLocaleString('es-CO',{timeZone:'America/Bogota'})+'</strong></div></div>':'<div style="margin-top:18px;padding:14px;border:1px solid #f0c36d;color:#8a5a00">El entrenador todavía no ha confirmado la recepción del dinero.</div>');
 coachPaymentPrintWindow('Comprobante pago entrenador',body);
}
function printCoachPaymentsReport(){
 const filtered=coachPayments.filter(p=>(coachFilter==='Todos'||p.coach_id===coachFilter)&&(!coachPeriod||p.period===coachPeriod)&&(coachStatus==='Todos'||p.status===coachStatus));
 if(!filtered.length)return toast('No hay pagos para generar el reporte con estos filtros.');
 const total=filtered.reduce((s,p)=>s+Number(p.amount||0),0),confirmed=filtered.filter(p=>p.status==='confirmed').length,pending=filtered.length-confirmed;
 const coachLabel=coachFilter==='Todos'?'Todos':(filtered[0]?.coach_name||'Entrenador');
 const rows=filtered.map(p=>'<tr><td>'+dateText(p.paid_date)+'</td><td>'+esc(p.coach_name)+'</td><td>'+esc(p.period)+'</td><td>'+esc(p.concept)+'</td><td>'+money(p.amount)+'</td><td>'+(p.status==='confirmed'?'Confirmado':'Pendiente')+'</td></tr>').join('');
 const body='<div class="head"><div><span class="label">REPORTE DE PAGOS A ENTRENADORES</span><h1>Pagos del club</h1><div class="sub">Entrenador: '+esc(coachLabel)+' · Periodo: '+esc(coachPeriod||'Todos')+'</div></div><span class="status">'+filtered.length+' MOVIMIENTOS</span></div>'+
 '<div class="grid"><div class="cell"><span class="label">TOTAL PAGADO</span><strong>'+money(total)+'</strong></div><div class="cell"><span class="label">CONFIRMADOS</span><strong>'+confirmed+'</strong></div><div class="cell"><span class="label">PENDIENTES</span><strong>'+pending+'</strong></div><div class="cell"><span class="label">GENERADO</span><strong>'+dateText(accountingToday())+'</strong></div></div>'+
 '<table class="tbl"><thead><tr><th>Fecha</th><th>Entrenador</th><th>Periodo</th><th>Concepto</th><th>Valor</th><th>Estado</th></tr></thead><tbody>'+rows+'</tbody></table>';
 coachPaymentPrintWindow('Reporte pagos entrenadores',body);
}


let uniformInventory={items:[],movements:[]};
async function loadUniformInventory(){
 const el=document.querySelector('#uniform-inventory-content');if(!el)return;
 try{uniformInventory=await api('inventory');paintUniformInventory()}catch(e){el.innerHTML=errorBox(e.message)}
}
function paintUniformInventory(){
 const el=document.querySelector('#uniform-inventory-content');if(!el)return;
 const items=uniformInventory.items||[],moves=uniformInventory.movements||[];
 const units=items.reduce((s,i)=>s+Number(i.stock||0),0);
 const stockValue=items.reduce((s,i)=>s+(Number(i.stock||0)*Number(i.last_unit_cost||0)),0);
 const saleValue=items.reduce((s,i)=>s+(Number(i.stock||0)*Number(i.sale_price||0)),0);
 el.innerHTML=`
 <section class="card">
  <div class="card-head"><div><h2>Uniformes e inventario</h2><p>Controla entradas, existencias y ventas por prenda y talla.</p></div><div class="actions"><button class="btn" onclick="uniformSaleForm()">Registrar venta</button><button class="btn primary" onclick="uniformEntryForm()">Registrar entrada</button></div></div>
  <div class="stats">
   ${stat('Unidades disponibles',units,'Stock actual','check')}
   ${stat('Costo estimado del stock',money(stockValue),'Según último costo registrado','wallet')}
   ${stat('Valor potencial de venta',money(saleValue),'Según precio de venta','wallet')}
  </div>
  <div class="table-wrap"><table class="roster-table"><thead><tr><th>Prenda</th><th>Talla</th><th>Existencias</th><th>Último costo</th><th>Precio de venta</th><th>Valor inventario</th></tr></thead><tbody>
   ${items.map(i=>`<tr><td><strong>${esc(i.name)}</strong></td><td>${esc(i.size)}</td><td><span class="badge ${Number(i.stock)>0?'ok':'warn'}">${i.stock}</span></td><td>${money(i.last_unit_cost||0)}</td><td><strong>${money(i.sale_price||0)}</strong></td><td>${money(Number(i.stock||0)*Number(i.last_unit_cost||0))}</td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Aún no hay uniformes registrados.</div></td></tr>'}
  </tbody></table></div>
 </section>
 <section class="card">
  <div class="card-head"><div><h2>Últimas entradas</h2><p>Uniformes recibidos por el club.</p></div></div>
  <div class="table-wrap"><table class="roster-table"><thead><tr><th>Fecha</th><th>Prenda</th><th>Talla</th><th>Cant.</th><th>Costo</th><th>Proveedor</th></tr></thead><tbody>
   ${moves.filter(m=>m.kind==='entry').map(m=>`<tr><td>${dateText(m.movement_date)}</td><td><strong>${esc(m.name)}</strong></td><td>${esc(m.size)}</td><td>${m.quantity}</td><td>${money(m.unit_cost)}</td><td>${esc(m.supplier||'No registrado')}</td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Aún no hay entradas registradas.</div></td></tr>'}
  </tbody></table></div>
 </section>
 <section class="card">
  <div class="card-head"><div><h2>Últimas ventas</h2><p>Ventas que ya descontaron inventario.</p></div></div>
  <div class="table-wrap"><table class="roster-table"><thead><tr><th>Fecha</th><th>Uniforme</th><th>Deportista</th><th>Cant.</th><th>Total</th><th>Medio</th></tr></thead><tbody>
   ${moves.filter(m=>m.kind==='sale').map(m=>`<tr><td>${dateText(m.movement_date)}</td><td><strong>${esc(m.name)}</strong><br><span class="muted">Talla ${esc(m.size)}</span></td><td>${esc(m.athlete_name||'')}</td><td>${m.quantity}</td><td><strong>${money(Number(m.quantity)*Number(m.unit_price||0))}</strong></td><td>${esc(m.method||'')}${m.reference?'<br><span class="muted">Ref. '+esc(m.reference)+'</span>':''}</td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Aún no hay ventas registradas.</div></td></tr>'}
  </tbody></table></div>
 </section>`;
}
function uniformEntryForm(){
 const token=crypto.randomUUID();
 showModal('Registrar entrada de uniformes',`
  <p class="sub" style="margin-bottom:18px">Registra cada combinación de prenda y talla que ingresa al inventario.</p>
  <form id="uniform-entry-form"><div class="form-grid">
   ${field('Prenda','name','','text',true,true,100)}
   ${field('Talla','size','','text',true,false,30)}
   ${field('Cantidad','quantity','','number',true,false,6)}
   ${field('Costo unitario','unitCost','','number',true,false,12)}
   ${field('Precio de venta','salePrice','','number',true,false,12)}
   ${field('Proveedor (opcional)','supplier','','text',false,true,150)}
   ${field('Fecha de entrada','movementDate',accountingToday(),'date')}
   <label class="field full">Observación (opcional)<textarea name="notes" rows="3" maxlength="600"></textarea></label>
  </div>
  <div class="notice neutral" style="margin-top:14px">Ejemplo: Uniforme de competencia · talla 12 · 8 unidades. Si luego registras otra entrada de la misma prenda y talla, se sumará al inventario existente.</div>
  <div id="uniform-entry-error"></div><div class="form-actions"><button type="button" class="btn" onclick="modal.close()">Cancelar</button><button class="btn primary" type="submit">Guardar entrada</button></div></form>`);
 document.querySelector('#uniform-entry-form').onsubmit=async e=>{
  e.preventDefault();const form=e.target,btn=form.querySelector('[type=submit]');btn.disabled=true;
  const d=Object.fromEntries(new FormData(form));d.quantity=Number(d.quantity);d.unitCost=Number(d.unitCost);d.salePrice=Number(d.salePrice);d.requestId=token;
  try{uniformInventory=await api('inventory/entries','POST',d);modal.close();paintUniformInventory();toast('Entrada de uniformes registrada.')}
  catch(err){document.querySelector('#uniform-entry-error').innerHTML=errorBox(err.message);btn.disabled=false}
 };
}

function uniformSaleForm(){
 const items=(uniformInventory.items||[]).filter(i=>Number(i.stock)>0);
 const athletes=(state.athletes||[]).filter(a=>a.status==='active').sort((a,b)=>a.name.localeCompare(b.name,'es'));
 if(!items.length)return toast('No hay uniformes con existencias disponibles.');
 if(!athletes.length)return toast('No hay deportistas activos para asociar la venta.');
 const token=crypto.randomUUID();
 showModal('Registrar venta de uniforme',`
  <p class="sub" style="margin-bottom:18px">La venta descontará automáticamente el inventario y se sumará a los ingresos del club.</p>
  <form id="uniform-sale-form"><div class="form-grid">
   <label class="field full">Uniforme<select name="itemId" onchange="syncUniformSalePrice(this.value)">${items.map(i=>'<option value="'+esc(i.id)+'" data-price="'+Number(i.sale_price||0)+'">'+esc(i.name)+' · Talla '+esc(i.size)+' · '+i.stock+' disponibles</option>').join('')}</select></label>
   <label class="field full">Buscar deportista<input id="uniform-athlete-search" type="search" placeholder="Escribe nombre o categoría" autocomplete="off" oninput="filterUniformAthletes(this.value)"></label>
   <label class="field full">Deportista<select name="athleteId" id="uniform-athlete-select">${athletes.map(a=>'<option value="'+esc(a.id)+'" data-search="'+esc((a.name+' '+a.category).toLowerCase())+'">'+esc(a.name)+' · '+esc(a.category)+'</option>').join('')}</select></label>
   ${field('Cantidad','quantity','1','number',true,false,4)}
   ${field('Precio unitario','unitPrice',items[0]?.sale_price||'','number',true,false,12)}
   <label class="field">Medio de pago<select name="method"><option>Efectivo</option><option>Transferencia</option></select></label>
   ${field('Referencia (si es transferencia)','reference','','text',false,false,150)}
   ${field('Fecha de venta','movementDate',accountingToday(),'date')}
   <label class="field full">Observación (opcional)<textarea name="notes" rows="3" maxlength="600"></textarea></label>
  </div>
  <div id="uniform-sale-error"></div><div class="form-actions"><button type="button" class="btn" onclick="modal.close()">Cancelar</button><button class="btn primary" type="submit">Registrar venta</button></div></form>`);
 document.querySelector('#uniform-sale-form').onsubmit=async e=>{
  e.preventDefault();const form=e.target,btn=form.querySelector('[type=submit]');btn.disabled=true;
  const d=Object.fromEntries(new FormData(form));d.quantity=Number(d.quantity);d.unitPrice=Number(d.unitPrice);d.requestId=token;
  try{uniformInventory=await api('inventory/sales','POST',d);modal.close();paintUniformInventory();toast('Venta registrada y descontada del inventario.')}
  catch(err){document.querySelector('#uniform-sale-error').innerHTML=errorBox(err.message);btn.disabled=false}
 };
}
function syncUniformSalePrice(itemId){
 const item=(uniformInventory.items||[]).find(i=>i.id===itemId),input=document.querySelector('#uniform-sale-form [name=unitPrice]');
 if(item&&input)input.value=Number(item.sale_price||0);
}

function filterUniformAthletes(query){
 const select=document.querySelector('#uniform-athlete-select');if(!select)return;
 const q=String(query||'').trim().toLowerCase();
 let firstVisible=null;
 [...select.options].forEach(o=>{
  const show=!q||(o.dataset.search||'').includes(q);
  o.hidden=!show;
  if(show&&!firstVisible)firstVisible=o;
 });
 if(firstVisible)select.value=firstVisible.value;
}


let expenseData={suppliers:[],expenses:[]};
async function loadExpenses(){
 const el=document.querySelector('#expenses-content');if(!el)return;
 try{expenseData=await api('expenses');paintExpenses()}catch(e){el.innerHTML=errorBox(e.message)}
}
function expenseStatus(e){
 if(e.status==='paid')return '<span class="badge ok">Pagado</span>';
 if(e.status==='partial')return '<span class="badge blue">Pago parcial</span>';
 return '<span class="badge warn">Pendiente</span>';
}
function expensePaymentRows(e){
 const rows=(expenseData.payments||[]).filter(p=>Number(p.expense_id)===Number(e.id));
 if(rows.length)return rows;
 if(e.status==='paid'&&Number(e.paid_amount||0)>0)return [{id:'legacy-'+e.id,expense_id:e.id,payment_date:e.paid_date||e.expense_date,amount:e.amount,method:e.method||'',reference:e.reference||'',recorder:e.recorder||''}];
 return [];
}
function paintExpenses(){
 const el=document.querySelector('#expenses-content');if(!el)return;
 const expenses=expenseData.expenses||[],suppliers=expenseData.suppliers||[];
 const paidTotal=expenses.reduce((s,e)=>s+Number(e.paid_amount||0),0);
 const pendingExpenses=expenses.filter(e=>Number(e.balance||0)>0);
 const pendingTotal=pendingExpenses.reduce((s,e)=>s+Number(e.balance||0),0);
 const partialCount=expenses.filter(e=>e.status==='partial').length;
 el.innerHTML=`
 <section class="card">
  <div class="card-head"><div><h2>Gastos y proveedores</h2><p>Registra obligaciones, abonos y pagos del club.</p></div><div class="actions"><button class="btn" onclick="supplierForm()">Nuevo proveedor</button><button class="btn primary" onclick="expenseForm()">Registrar gasto</button></div></div>
  <div class="stats">
   ${stat('Egresos realizados',money(paidTotal),'Pagos y abonos registrados','wallet')}
   ${stat('Saldo por pagar',money(pendingTotal),pendingExpenses.length+' obligaciones abiertas','clock')}
   ${stat('Pagos parciales',partialCount,'Gastos con abonos','check')}
   ${stat('Proveedores',suppliers.length,'Activos registrados','users')}
  </div>
 </section>
 <section class="card">
  <div class="card-head"><div><h2>Movimientos de gastos</h2><p>Consulta el valor total, lo abonado y el saldo de cada obligación.</p></div></div>
  <div class="table-wrap"><table class="roster-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Total</th><th>Abonado</th><th>Saldo</th><th>Estado</th><th>Vence</th><th></th></tr></thead><tbody>
   ${expenses.map((e,idx)=>`<tr><td>${dateText(e.expense_date)}</td><td><strong>${esc(e.concept)}</strong><br><span class="muted">${esc(e.category)} · ${esc(e.supplier_name||'Sin proveedor')}</span>${e.notes?'<br><span class="muted">'+esc(e.notes)+'</span>':''}</td><td><strong>${money(e.amount)}</strong></td><td><strong>${money(e.paid_amount||0)}</strong></td><td><strong>${money(e.balance||0)}</strong></td><td>${expenseStatus(e)}</td><td>${Number(e.balance||0)>0?(e.due_date?dateText(e.due_date):'Sin fecha'):'—'}</td><td><div class="access-actions">${Number(e.balance||0)>0?'<button class="access-action-btn" onclick="payExpenseForm('+e.id+')">Registrar abono</button>':''}${Number(e.paid_amount||0)>0?'<button class="access-action-btn secondary" onclick="expensePaymentHistory('+e.id+')">Ver pagos</button>':''}<button type="button" class="access-action-btn secondary" data-delete-expense-index="${idx}">Eliminar</button></div></td></tr>`).join('')||'<tr><td colspan="8"><div class="empty">Aún no hay gastos registrados.</div></td></tr>'}
  </tbody></table></div>
 </section>
 <section class="card">
  <div class="card-head"><div><h2>Proveedores</h2><p>Directorio básico para compras y servicios del club.</p></div><button class="btn" onclick="supplierForm()">Agregar proveedor</button></div>
  <div class="table-wrap"><table><thead><tr><th>Proveedor</th><th>Documento</th><th>Teléfono</th><th>Correo</th><th>Observación</th></tr></thead><tbody>
   ${suppliers.map(s=>`<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.document||'—')}</td><td>${esc(s.phone||'—')}</td><td>${esc(s.email||'—')}</td><td>${esc(s.notes||'—')}</td></tr>`).join('')||'<tr><td colspan="5"><div class="empty">Aún no hay proveedores registrados.</div></td></tr>'}
  </tbody></table></div>
 </section>`;
 el.querySelectorAll('[data-delete-expense-index]').forEach(btn=>{
  btn.addEventListener('click',ev=>{
   ev.preventDefault();
   ev.stopPropagation();
   const idx=Number(btn.dataset.deleteExpenseIndex);
   const expense=(expenseData.expenses||[])[idx];
   if(!expense){toast('No se pudo identificar el gasto. Recarga la página e inténtalo de nuevo.');return}
   openExpenseDeleteModal(expense);
  });
 });
}
function expensePaymentHistory(id){
 const e=(expenseData.expenses||[]).find(x=>Number(x.id)===Number(id));if(!e)return;
 const rows=expensePaymentRows(e);
 showModal('Pagos y abonos · '+esc(e.concept),`<div class="stats"><article class="stat"><div class="stat-top">Valor total</div><strong>${money(e.amount)}</strong></article><article class="stat"><div class="stat-top">Abonado</div><strong>${money(e.paid_amount||0)}</strong></article><article class="stat"><div class="stat-top">Saldo pendiente</div><strong>${money(e.balance||0)}</strong></article></div><div class="table-wrap" style="margin-top:18px"><table><thead><tr><th>Fecha</th><th>Valor</th><th>Medio</th><th>Referencia</th><th>Registró</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${dateText(p.payment_date)}</td><td><strong>${money(p.amount)}</strong></td><td>${esc(p.method||'—')}</td><td>${esc(p.reference||'—')}</td><td>${esc(p.recorder||'—')}</td></tr>`).join('')||'<tr><td colspan="5"><div class="empty">Aún no hay abonos registrados.</div></td></tr>'}</tbody></table></div><div class="form-actions"><button class="btn" type="button" onclick="modal.close()">Cerrar</button>${Number(e.balance||0)>0?'<button class="btn primary" type="button" onclick="payExpenseForm('+e.id+')">Registrar abono</button>':''}</div>`);
}
function openExpenseDeleteModal(e){
 if(!e||e.id===undefined||e.id===null){toast('No se pudo identificar el gasto.');return}
 const hasPayments=Number(e.paid_amount||0)>0;
 showModal('Eliminar gasto',`
  <div class="notice" style="margin-bottom:16px">
   <strong>Esta acción es definitiva.</strong><br>
   Se eliminará el gasto <strong>${esc(e.concept)}</strong> por ${money(e.amount)}.
   ${hasPayments?'<br>También se eliminarán todos los abonos asociados a este gasto.':''}
  </div>
  <div class="detail-grid">
   <div class="detail"><small>Valor total</small>${money(e.amount)}</div>
   <div class="detail"><small>Abonado</small>${money(e.paid_amount||0)}</div>
   <div class="detail"><small>Saldo</small>${money(e.balance||0)}</div>
  </div>
  <div id="delete-expense-error"></div>
  <div class="form-actions">
   <button type="button" class="btn" id="cancel-delete-expense">Cancelar</button>
   <button type="button" class="btn danger" id="confirm-delete-expense" data-expense-id="${Number(e.id)}">Eliminar definitivamente</button>
  </div>`);
 const cancel=document.querySelector('#cancel-delete-expense');
 if(cancel)cancel.addEventListener('click',()=>modal.close());
}
async function executeDeleteExpense(id){
 const btn=document.querySelector('#confirm-delete-expense'),el=document.querySelector('#delete-expense-error');
 if(btn){btn.disabled=true;btn.textContent='Eliminando…'}
 if(el)el.innerHTML='<div class="notice neutral">Procesando eliminación…</div>';
 try{
  expenseData=await api('expenses/expenses/'+id+'/delete','POST',{confirm:true});
  modal.close();
  paintExpenses();
  toast('Gasto y abonos asociados eliminados.');
 }catch(err){
  if(el)el.innerHTML=errorBox(err.message||'No se pudo eliminar el gasto.');
  if(btn){btn.disabled=false;btn.textContent='Eliminar definitivamente'}
 }
}

function supplierForm(){
 showModal('Nuevo proveedor',`
  <form id="supplier-form"><div class="form-grid">
   ${field('Nombre o razón social','name','','text',true,true,120)}
   ${field('NIT / documento (opcional)','document','','text',false,false,50)}
   ${field('Teléfono (opcional)','phone','','text',false,false,40)}
   ${field('Correo (opcional)','email','','email',false,true,180)}
   <label class="field full">Observación (opcional)<textarea name="notes" rows="3" maxlength="500"></textarea></label>
  </div><div id="supplier-error"></div><div class="form-actions"><button type="button" class="btn" onclick="modal.close()">Cancelar</button><button class="btn primary" type="submit">Guardar proveedor</button></div></form>`);
 document.querySelector('#supplier-form').onsubmit=async e=>{
  e.preventDefault();const form=e.target,btn=form.querySelector('[type=submit]');btn.disabled=true;
  const d=Object.fromEntries(new FormData(form));
  try{expenseData=await api('expenses/suppliers','POST',d);modal.close();paintExpenses();toast('Proveedor registrado.')}
  catch(err){document.querySelector('#supplier-error').innerHTML=errorBox(err.message);btn.disabled=false}
 };
}
function expenseForm(){
 const suppliers=expenseData.suppliers||[],token=crypto.randomUUID();
 const categories=['Arriendo','Canchas','Arbitrajes','Transporte','Implementación deportiva','Uniformes / compras','Servicios','Publicidad','Administración','Otros'];
 showModal('Registrar gasto',`
  <p class="sub" style="margin-bottom:18px">Puedes registrar un gasto ya pagado o dejarlo como cuenta pendiente.</p>
  <form id="expense-form"><div class="form-grid">
   ${field('Concepto','concept','','text',true,true,180)}
   <label class="field">Categoría<select name="category">${categories.map(x=>'<option>'+esc(x)+'</option>').join('')}</select></label>
   ${field('Valor','amount','','number',true,false,12)}
   <label class="field">Proveedor<select name="supplierId"><option value="">Sin proveedor</option>${suppliers.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join('')}</select></label>
   ${field('Fecha del gasto','expenseDate',accountingToday(),'date')}
   <label class="field">Estado<select name="status" onchange="toggleExpenseStatusFields(this.value)"><option value="paid">Pagado</option><option value="pending">Pendiente por pagar</option></select></label>
   <div id="expense-paid-fields" class="full-width"><div class="form-grid">
    <label class="field">Medio de pago<select name="method"><option>Efectivo</option><option>Transferencia</option></select></label>
    ${field('Referencia (si es transferencia)','reference','','text',false,false,150)}
   </div></div>
   <div id="expense-pending-fields" class="full-width" style="display:none"><div class="form-grid">
    ${field('Fecha de vencimiento','dueDate',accountingToday(),'date',false,false,10)}
   </div></div>
   <label class="field full">Observación (opcional)<textarea name="notes" rows="3" maxlength="600"></textarea></label>
  </div><div id="expense-error"></div><div class="form-actions"><button type="button" class="btn" onclick="modal.close()">Cancelar</button><button class="btn primary" type="submit">Guardar gasto</button></div></form>`);
 document.querySelector('#expense-form').onsubmit=async e=>{
  e.preventDefault();const form=e.target,btn=form.querySelector('[type=submit]');btn.disabled=true;
  const d=Object.fromEntries(new FormData(form));d.amount=Number(d.amount);d.requestId=token;
  try{expenseData=await api('expenses/expenses','POST',d);modal.close();paintExpenses();toast(d.status==='paid'?'Gasto registrado.':'Cuenta pendiente registrada.')}
  catch(err){document.querySelector('#expense-error').innerHTML=errorBox(err.message);btn.disabled=false}
 };
}
function toggleExpenseStatusFields(status){
 const paid=document.querySelector('#expense-paid-fields'),pending=document.querySelector('#expense-pending-fields');
 if(paid)paid.style.display=status==='paid'?'block':'none';
 if(pending)pending.style.display=status==='pending'?'block':'none';
}
function payExpenseForm(id){
 const e=(expenseData.expenses||[]).find(x=>Number(x.id)===Number(id));if(!e||Number(e.balance||0)<=0)return;
 const token=crypto.randomUUID();
 showModal('Registrar abono',`
  <div class="notice neutral" style="margin-bottom:16px"><strong>${esc(e.concept)}</strong><br>Valor total: ${money(e.amount)} · Abonado: ${money(e.paid_amount||0)} · <strong>Saldo: ${money(e.balance||0)}</strong></div>
  <form id="pay-expense-form"><div class="form-grid">
   ${field('Valor del abono','amount','','number',true,false,12)}
   <label class="field">Medio de pago<select name="method"><option>Efectivo</option><option>Transferencia</option></select></label>
   ${field('Referencia (si es transferencia)','reference','','text',false,false,150)}
   ${field('Fecha del abono','paidDate',accountingToday(),'date')}
  </div><p class="muted">El abono no puede superar el saldo pendiente de ${money(e.balance||0)}.</p><div id="pay-expense-error"></div><div class="form-actions"><button type="button" class="btn" onclick="modal.close()">Cancelar</button><button class="btn primary" type="submit">Registrar abono</button></div></form>`);
 document.querySelector('#pay-expense-form').onsubmit=async ev=>{
  ev.preventDefault();const form=ev.target,btn=form.querySelector('[type=submit]');btn.disabled=true;
  const d=Object.fromEntries(new FormData(form));d.amount=Number(d.amount);d.requestId=token;
  if(!Number.isSafeInteger(d.amount)||d.amount<=0||d.amount>Number(e.balance||0)){document.querySelector('#pay-expense-error').innerHTML=errorBox('Ingresa un abono válido que no supere el saldo pendiente.');btn.disabled=false;return}
  try{
   expenseData=await api('expenses/expenses/'+id+'/pay','POST',d);
   const updated=(expenseData.expenses||[]).find(x=>Number(x.id)===Number(id));
   modal.close();paintExpenses();toast(updated?.status==='paid'?'Gasto pagado completamente.':'Abono registrado.');
  }catch(err){document.querySelector('#pay-expense-error').innerHTML=errorBox(err.message);btn.disabled=false}
 };
}
async function loadAccountingSummary(fromForm=false){
 const el=document.querySelector('#accounting-summary-content');if(!el)return;
 if(fromForm){
  accountingStart=document.querySelector('[name=summaryStart]')?.value||accountingStart;
  accountingEnd=document.querySelector('[name=summaryEnd]')?.value||accountingEnd;
 }
 el.innerHTML='<p>Cargando resumen contable…</p>';
 try{
  const [income,expensesResult,payrollResult]=await Promise.all([
   api('finance/reports/income','POST',{startDate:accountingStart,endDate:accountingEnd}),
   api('expenses'),
   api('payroll')
  ]);
  const expenses=(expensesResult.expenses||[]),payments=(expensesResult.payments||[]);
  const expensesById=new Map(expenses.map(e=>[Number(e.id),e]));
  const paymentExpenseIds=new Set(payments.map(p=>Number(p.expense_id)));
  const expenseMovements=payments.filter(p=>p.payment_date>=accountingStart&&p.payment_date<=accountingEnd).map(p=>({...p,source:'payment'}));
  expenses.filter(e=>e.status==='paid'&&!paymentExpenseIds.has(Number(e.id))).forEach(e=>{
   const d=e.paid_date||e.expense_date;
   if(d>=accountingStart&&d<=accountingEnd)expenseMovements.push({expense_id:e.id,payment_date:d,amount:e.amount,method:e.method||'',reference:e.reference||'',category:e.category,concept:e.concept,supplier_name:e.supplier_name||'',source:'legacy'});
  });
  expenseMovements.forEach(p=>{const e=expensesById.get(Number(p.expense_id));if(e){p.category=p.category||e.category;p.concept=p.concept||e.concept;p.supplier_name=p.supplier_name||e.supplier_name}});
  const pendingExpenses=expenses.filter(e=>Number(e.balance||0)>0);
  const coach=payrollResult.payments||[];
  const coachInPeriod=coach.filter(p=>p.paid_date>=accountingStart&&p.paid_date<=accountingEnd);
  const expenseTotal=expenseMovements.reduce((s,e)=>s+Number(e.amount||0),0);
  const coachTotal=coachInPeriod.reduce((s,p)=>s+Number(p.amount||0),0);
  const outTotal=expenseTotal+coachTotal;
  const pendingTotal=pendingExpenses.reduce((s,e)=>s+Number(e.balance||0),0);
  const net=Number(income.total||0)-outTotal;
  accountingSummary={startDate:accountingStart,endDate:accountingEnd,income,expenseMovements,pendingExpenses,coachInPeriod,expenseTotal,coachTotal,outTotal,pendingTotal,net};
  paintAccountingSummary();
 }catch(e){el.innerHTML=errorBox(e.message)}
}
function paintAccountingSummary(){
 const el=document.querySelector('#accounting-summary-content'),r=accountingSummary;if(!el||!r)return;
 const categories=new Map();
 r.expenseMovements.forEach(e=>categories.set(e.category||'Otros',(categories.get(e.category||'Otros')||0)+Number(e.amount||0)));
 if(r.coachTotal)categories.set('Pagos a entrenadores',(categories.get('Pagos a entrenadores')||0)+r.coachTotal);
 const pendingCoach=r.coachInPeriod.filter(p=>p.status==='pending_confirmation').length;
 el.innerHTML=`
  <div class="card-head" style="margin:16px 0"><div><h2>Resultado del periodo</h2><p>${dateText(r.startDate)} al ${dateText(r.endDate)}</p></div><button class="btn" onclick="printAccountingSummary()">Generar cierre / PDF</button></div>
  <div class="stats">
   ${stat('Ingresos',money(r.income.total||0),r.income.count+' movimientos','wallet')}
   ${stat('Egresos pagados',money(r.outTotal),r.expenseMovements.length+r.coachInPeriod.length+' movimientos','wallet')}
   ${stat('Saldo neto',money(r.net),r.net>=0?'Resultado positivo':'Resultado negativo','check')}
  </div>
  <div class="stats">
   ${stat('Cuentas por pagar',money(r.pendingTotal),r.pendingExpenses.length+' obligaciones abiertas','clock')}
   ${stat('Pagos a entrenadores',money(r.coachTotal),r.coachInPeriod.length+' pagos','wallet')}
   ${stat('Por confirmar entrenador',pendingCoach,pendingCoach?'Requieren confirmación':'Sin confirmaciones pendientes','clock')}
  </div>
  <div class="dashboard-grid">
   <section class="card"><div class="card-head"><h2>Ingresos por concepto</h2></div>
    ${r.income.concepts.map(x=>`<div class="info-row"><strong>${esc(accountingKindLabel(x.kind))}</strong><strong>${money(x.total)}</strong></div>`).join('')||'<div class="empty">Sin ingresos en el periodo.</div>'}
   </section>
   <section class="card"><div class="card-head"><h2>Egresos pagados por concepto</h2></div>
    ${[...categories.entries()].sort((a,b)=>b[1]-a[1]).map(([name,total])=>`<div class="info-row"><strong>${esc(name)}</strong><strong>${money(total)}</strong></div>`).join('')||'<div class="empty">Sin egresos pagados en el periodo.</div>'}
   </section>
  </div>
  <section class="card">
   <div class="card-head"><div><h2>Cuentas pendientes</h2><p>Obligaciones con saldo pendiente, incluidos los gastos con pagos parciales.</p></div><span class="badge ${r.pendingExpenses.length?'warn':'ok'}">${r.pendingExpenses.length} pendientes</span></div>
   <div class="table-wrap"><table><thead><tr><th>Concepto</th><th>Proveedor</th><th>Vencimiento</th><th>Total</th><th>Abonado</th><th>Saldo</th></tr></thead><tbody>
    ${r.pendingExpenses.map(e=>`<tr><td><strong>${esc(e.concept)}</strong><br><span class="muted">${esc(e.category)}</span></td><td>${esc(e.supplier_name||'Sin proveedor')}</td><td>${e.due_date?dateText(e.due_date):'Sin fecha'}</td><td>${money(e.amount)}</td><td>${money(e.paid_amount||0)}</td><td><strong>${money(e.balance||0)}</strong></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">No hay cuentas pendientes por pagar.</div></td></tr>'}
   </tbody></table></div>
  </section>`;
}
function printAccountingSummary(){
 const r=accountingSummary;if(!r)return toast('Primero genera el resumen contable.');
 const categoryMap=new Map();
 r.expenseMovements.forEach(e=>categoryMap.set(e.category||'Otros',(categoryMap.get(e.category||'Otros')||0)+Number(e.amount||0)));
 if(r.coachTotal)categoryMap.set('Pagos a entrenadores',(categoryMap.get('Pagos a entrenadores')||0)+r.coachTotal);
 const incomes=r.income.concepts.map(x=>'<tr><td>'+esc(accountingKindLabel(x.kind))+'</td><td>'+money(x.total)+'</td></tr>').join('');
 const expenses=[...categoryMap.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+money(v)+'</td></tr>').join('');
 const pending=r.pendingExpenses.map(e=>'<tr><td>'+esc(e.concept)+'</td><td>'+esc(e.supplier_name||'Sin proveedor')+'</td><td>'+(e.due_date?dateText(e.due_date):'Sin fecha')+'</td><td>'+money(e.amount)+'</td><td>'+money(e.paid_amount||0)+'</td><td>'+money(e.balance||0)+'</td></tr>').join('');
 const body='<div class="head"><div><span class="label">CIERRE CONTABLE DEL PERIODO</span><h1>'+dateText(r.startDate)+' al '+dateText(r.endDate)+'</h1><div class="sub">Generado: '+dateText(accountingToday())+'</div></div><span class="status">'+(r.net>=0?'SALDO POSITIVO':'SALDO NEGATIVO')+'</span></div>'+
 '<div class="grid"><div class="cell"><span class="label">INGRESOS</span><strong>'+money(r.income.total||0)+'</strong></div><div class="cell"><span class="label">EGRESOS PAGADOS</span><strong>'+money(r.outTotal)+'</strong></div><div class="cell"><span class="label">SALDO NETO</span><strong>'+money(r.net)+'</strong></div><div class="cell"><span class="label">CUENTAS POR PAGAR</span><strong>'+money(r.pendingTotal)+'</strong></div></div>'+
 '<div class="grid" style="margin-top:18px"><div class="cell"><span class="label">INGRESOS POR CONCEPTO</span><table class="tbl"><tbody>'+incomes+'</tbody></table></div><div class="cell"><span class="label">EGRESOS PAGADOS POR CONCEPTO</span><table class="tbl"><tbody>'+expenses+'</tbody></table></div></div>'+
 '<div style="margin-top:22px"><span class="label">CUENTAS PENDIENTES</span><table class="tbl"><thead><tr><th>Concepto</th><th>Proveedor</th><th>Vence</th><th>Total</th><th>Abonado</th><th>Saldo</th></tr></thead><tbody>'+pending+'</tbody></table></div>';
 coachPaymentPrintWindow('Cierre contable García Herreros FC',body);
}

// Confirmation is delegated at document level because some browsers can lose a normal
// click after the modal opens or when the pointer moves slightly over the button.
if(!window.__expenseDeletePointerBound){
 window.__expenseDeletePointerBound=true;
 document.addEventListener('pointerdown',ev=>{
  const btn=ev.target?.closest?.('#confirm-delete-expense');
  if(!btn||btn.disabled)return;
  ev.preventDefault();
  ev.stopPropagation();
  executeDeleteExpense(Number(btn.dataset.expenseId));
 },true);
}
