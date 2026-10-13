'use strict';
const accountingToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let accountingReport=null,accountingStart=accountingToday().slice(0,7)+'-01',accountingEnd=accountingToday();
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
 const w=window.open('','_blank','noopener,noreferrer');
 if(!w)return toast('El navegador bloqueó la ventana del reporte. Permite ventanas emergentes e inténtalo de nuevo.');
 w.document.open();w.document.write(html);w.document.close();
}
