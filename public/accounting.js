'use strict';
const accountingToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let accountingReport=null,accountingStart=accountingToday().slice(0,7)+'-01',accountingEnd=accountingToday();
function accountingPage(){setTimeout(()=>{loadAccountingReport();loadCoachPayments()},0);return title('CONTABILIDAD','Ingresos y pagos del club.','Consulta los ingresos registrados y gestiona los pagos a entrenadores.')+`
<section class="card">
 <div class="form-grid">
  ${field('Desde','accountingStart',accountingStart,'date')}
  ${field('Hasta','accountingEnd',accountingEnd,'date')}
 </div>
 <div class="form-actions"><button type="button" class="btn primary" onclick="loadAccountingReport(true)">Generar reporte</button></div>
</section>
<div id="accounting-content" aria-live="polite">Cargando ingresos…</div><div id="coach-payments-content" aria-live="polite" style="margin-top:22px">Cargando pagos a entrenadores…</div>`}
async function loadAccountingReport(fromForm=false){
 const el=document.querySelector('#accounting-content');if(!el)return;
 if(fromForm){accountingStart=document.querySelector('[name=accountingStart]')?.value||accountingStart;accountingEnd=document.querySelector('[name=accountingEnd]')?.value||accountingEnd;}
 el.innerHTML='<p>Cargando reporte…</p>';
 try{accountingReport=await api('finance/reports/income','POST',{startDate:accountingStart,endDate:accountingEnd});paintAccountingReport()}catch(e){el.innerHTML=errorBox(e.message)}
}
function accountingKindLabel(k){return {mensualidad:'Mensualidades',inscripcion:'Inscripciones',practica:'Prácticas'}[k]||k}
function paintAccountingReport(){
 const el=document.querySelector('#accounting-content'),r=accountingReport;if(!el||!r)return;
 const cash=r.methods.find(x=>x.method==='Efectivo')?.total||0,transfer=r.methods.find(x=>x.method==='Transferencia')?.total||0;
 el.innerHTML=`
 <div class="form-actions" style="justify-content:flex-end;margin-bottom:14px">
  <button type="button" class="btn primary" onclick="printAccountingIncomeReport()">Generar PDF / Imprimir</button>
 </div>
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
  ${r.payments.map(p=>`<tr><td>${dateText(p.paid_date)}</td><td><strong>${esc(p.athlete_name)}</strong><br><span class="muted">${esc(p.category||'')}</span></td><td>${esc(p.concepts||'Pago')}</td><td>${esc(p.method)}</td><td><strong>${money(p.amount)}</strong></td><td><button class="btn link" onclick="receiptView(${p.id})">Ver ${p.id}</button></td></tr>`).join('')}
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


let coachPayments=[];
async function loadCoachPayments(){
 const el=document.querySelector('#coach-payments-content');if(!el)return;
 try{const r=await api('payroll');coachPayments=r.payments||[];paintCoachPayments()}catch(e){el.innerHTML=errorBox(e.message)}
}
function coachPaymentStatus(p){return p.status==='confirmed'?'<span class="badge ok">Recibido confirmado</span>':'<span class="badge warn">Pendiente de confirmación</span>'}
function paintCoachPayments(){
 const el=document.querySelector('#coach-payments-content');if(!el)return;
 const pending=coachPayments.filter(p=>p.status==='pending_confirmation').length;
 const total=coachPayments.reduce((s,p)=>s+Number(p.amount||0),0);
 el.innerHTML=`
 <section class="card">
  <div class="card-head"><div><h2>Pagos a entrenadores</h2><p>Registra el pago y el entrenador confirma posteriormente desde su cuenta.</p></div><button class="btn primary" onclick="coachPaymentForm()">Registrar pago</button></div>
  <div class="stats">
   ${stat('Pagos registrados',coachPayments.length,'Historial disponible','wallet')}
   ${stat('Pendientes de confirmar',pending,'Requieren confirmación del entrenador','clock')}
   ${stat('Total registrado',money(total),'Pagos a entrenadores','check')}
  </div>
  <div class="table-wrap"><table class="roster-table"><thead><tr><th>Fecha</th><th>Entrenador</th><th>Periodo</th><th>Concepto</th><th>Medio</th><th>Valor</th><th>Estado</th></tr></thead><tbody>
   ${coachPayments.map(p=>`<tr><td>${dateText(p.paid_date)}</td><td><strong>${esc(p.coach_name)}</strong></td><td>${esc(p.period)}</td><td>${esc(p.concept)}${p.notes?'<br><span class="muted">'+esc(p.notes)+'</span>':''}</td><td>${esc(p.method)}${p.reference?'<br><span class="muted">Ref. '+esc(p.reference)+'</span>':''}</td><td><strong>${money(p.amount)}</strong></td><td>${coachPaymentStatus(p)}${p.confirmed_at?'<br><span class="muted">'+new Date(p.confirmed_at).toLocaleString('es-CO',{timeZone:'America/Bogota'})+'</span>':''}</td></tr>`).join('')||'<tr><td colspan="7"><div class="empty">Aún no hay pagos registrados a entrenadores.</div></td></tr>'}
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
  el.innerHTML=`<section class="card"><div class="card-head"><div><h2>Mis pagos del club</h2><p>Confirma únicamente cuando hayas recibido el dinero.</p></div></div>${mine.length?'<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Periodo</th><th>Concepto</th><th>Valor</th><th>Estado</th><th></th></tr></thead><tbody>'+mine.map(p=>'<tr><td>'+dateText(p.paid_date)+'</td><td>'+esc(p.period)+'</td><td>'+esc(p.concept)+'</td><td><strong>'+money(p.amount)+'</strong></td><td>'+coachPaymentStatus(p)+'</td><td>'+(p.status==='pending_confirmation'?'<button class="btn primary" onclick="confirmCoachPayment('+p.id+')">Confirmar recibido</button>':'')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="empty">No tienes pagos registrados todavía.</div>'}</section>`;
 }catch(e){el.innerHTML=errorBox(e.message)}
}
async function confirmCoachPayment(id){
 if(!confirm('Confirma solo si ya recibiste este pago. ¿Deseas dejar constancia de recibido?'))return;
 try{await api('payroll/'+id+'/confirm','POST',{confirmed:true});await loadMyCoachPayments();toast('Pago confirmado como recibido.')}
 catch(e){toast(e.message)}
}
