'use strict';
let accountingReport=null,accountingStart=today().slice(0,7)+'-01',accountingEnd=today();
function accountingPage(){setTimeout(loadAccountingReport,0);return title('CONTABILIDAD','Ingresos del club.','Consulta los pagos confirmados por periodo y revisa su distribución.')+`
<section class="card">
 <div class="form-grid">
  ${field('Desde','accountingStart',accountingStart,'date')}
  ${field('Hasta','accountingEnd',accountingEnd,'date')}
 </div>
 <div class="form-actions"><button type="button" class="btn primary" onclick="loadAccountingReport(true)">Generar reporte</button></div>
</section>
<div id="accounting-content" aria-live="polite">Cargando ingresos…</div>`}
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
