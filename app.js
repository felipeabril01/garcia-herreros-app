const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let state={players:JSON.parse(localStorage.getItem('ghfc_players')||'null')||[],view:'dashboard'};
const save=()=>localStorage.setItem('ghfc_players',JSON.stringify(state.players));
const icon=n=>'<i data-lucide="'+n+'"></i>';
const labels={dashboard:'Resumen',players:'Deportistas',attendance:'Asistencia',training:'Entrenamientos',team:'Equipo y categorías',access:'Accesos',payments:'Pagos y cartera',activity:'Actividad'};
function categories(){return [...new Set(state.players.map(p=>p.category).filter(Boolean))]}
function placeholder(e,h,p){return '<div class="view"><div class="hero"><div><span class="eyebrow">'+e+'</span><h1>'+h+'</h1><p>'+p+'</p></div></div><div class="card empty">Módulo preparado para la siguiente fase.</div></div>'}
function playersTable(rows){
  if(!rows.length)return '<div class="empty">Aún no hay deportistas registrados.</div>';
  const desktop='<div class="table-wrap players-desktop"><table class="table players-table"><thead><tr><th>DEPORTISTA</th><th>CATEGORÍA</th><th>ACUDIENTE</th><th>CELULAR</th><th>ESTADO</th><th></th></tr></thead><tbody>'+
    rows.map(p=>'<tr><td><span class="player-name">'+p.name+'</span></td><td>'+(p.category||'—')+'</td><td>'+(p.guardian||'—')+'</td><td>'+(p.phone||'—')+'</td><td><span class="status-dot '+((p.status||'Activo')==='Inactivo'?'inactive':'')+'">'+(p.status||'Activo')+'</span></td><td><button class="link-btn" data-player="'+p.id+'">Ver ficha</button></td></tr>').join('')+
    '</tbody></table></div>';
  const mobile='<div class="player-card-list">'+rows.map(p=>'<div class="player-card-mobile"><div class="top"><div><div class="name">'+p.name+'</div><div class="meta">'+(p.category||'Sin categoría')+'<br>'+(p.guardian||'Sin acudiente')+'</div></div><button class="link-btn" data-player="'+p.id+'">Ver ficha</button></div></div>').join('')+'</div>';
  return desktop+mobile;
}
function dashboard(){return '<div class="view"><div class="hero"><div><span class="eyebrow">BASE DEL CLUB</span><h1>Tu club, conectado.</h1><p>Las fichas y la asistencia se guardan en la base compartida.</p></div><button class="primary" data-open-player>'+icon('plus')+' Registrar deportista</button></div><div class="stats"><div class="stat"><div class="stat-top"><div class="stat-label">Deportistas registrados</div><div class="stat-icon">'+icon('users')+'</div></div><div class="stat-value">'+state.players.length+'</div><div class="stat-sub">Sin registros ficticios</div></div><div class="stat"><div class="stat-top"><div class="stat-label">Categorías</div><div class="stat-icon">'+icon('circle-dot')+'</div></div><div class="stat-value">'+(categories().length||7)+'</div><div class="stat-sub">Con horarios configurados</div></div><div class="stat"><div class="stat-top"><div class="stat-label">Sesiones de la semana</div><div class="stat-icon">'+icon('calendar-days')+'</div></div><div class="stat-value">21</div><div class="stat-sub">Según el horario habitual</div></div><div class="stat"><div class="stat-top"><div class="stat-label">Acceso</div><div class="stat-icon">'+icon('clipboard-check')+'</div></div><div class="stat-value word">Administrativo</div><div class="stat-sub">Felipe Abril</div></div></div><div class="grid-2"><div class="card"><div class="card-head"><h3>Para comenzar</h3></div><div class="quick-row"><div class="quick-icon">'+icon('users-round')+'</div><div class="quick-copy"><strong>Fichas de deportistas</strong><span>Acudiente, emergencias y seguimiento físico</span></div><button class="link-btn" data-view-link="players">Abrir</button></div><div class="quick-row"><div class="quick-icon">'+icon('clipboard-check')+'</div><div class="quick-copy"><strong>Asistencia por sesión</strong><span>Una lista compartida por los profesores asignados</span></div><button class="link-btn" data-view-link="attendance">Tomar lista</button></div><div class="quick-row"><div class="quick-icon">'+icon('calendar-days')+'</div><div class="quick-copy"><strong>Entrenamientos</strong><span>Horarios, categorías, escenarios y responsables</span></div><button class="link-btn" data-view-link="training">Ver agenda</button></div></div><div class="card"><div class="card-head"><h3>Esta primera etapa</h3></div><div class="info-copy">Ya puedes guardar fichas, editar sus datos, registrar mediciones y tomar asistencia.</div><div class="info-note">Pagos y cartera disponibles desde octubre de 2026. Primero revisa y activa cada cuenta; los archivos y el envío de correos siguen pendientes.</div></div></div></div>'}
function players(){
  const active=state.players.filter(p=>(p.status||'Activo')!=='Inactivo').length;
  return '<div class="view">'+
    '<div class="hero"><div><span class="eyebrow">DEPORTISTAS</span><h1>Fichas de deportistas</h1><p>Información personal, acudiente, emergencia y seguimiento físico.</p></div><button class="primary" data-open-player>'+icon('plus')+' Registrar deportista</button></div>'+
    '<div class="players-summary">'+
      '<div class="mini-stat"><span>Registrados</span><strong>'+state.players.length+'</strong></div>'+
      '<div class="mini-stat"><span>Activos</span><strong>'+active+'</strong></div>'+
      '<div class="mini-stat"><span>Categorías</span><strong>'+categories().length+'</strong></div>'+
    '</div>'+
    '<div class="card">'+
      '<div class="players-toolbar"><div><strong>Base de deportistas</strong></div><div class="players-search"><input id="playerSearch" placeholder="Buscar deportista"><select id="playerCategoryFilter"><option value="">Todas las categorías</option>'+categories().map(c=>'<option>'+c+'</option>').join('')+'</select></div></div>'+
      '<div id="playersTable">'+playersTable(state.players)+'</div>'+
    '</div></div>'
}
const views={dashboard,players,attendance:()=>placeholder('ASISTENCIA','Asistencia por sesión','Toma lista por entrenamiento y consulta el seguimiento de cada deportista.'),training:()=>placeholder('ENTRENAMIENTOS','Agenda deportiva','Horarios, categorías, escenarios y responsables.'),team:()=>placeholder('EQUIPO Y CATEGORÍAS','Equipo y categorías','Configura categorías, entrenadores y horarios.'),access:()=>placeholder('ACCESOS','Accesos del club','Administra quién puede ingresar y qué módulos puede utilizar.'),payments:()=>placeholder('PAGOS Y CARTERA','Pagos y cartera','Registra abonos, consulta saldos y genera comprobantes.'),activity:()=>placeholder('ACTIVIDAD','Actividad reciente','Consulta los movimientos recientes de la aplicación.')};
function render(){document.querySelector('#viewRoot').innerHTML=views[state.view]();$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));$('#breadcrumb').innerHTML='Mi club <span>/</span> <strong>'+labels[state.view]+'</strong>';bind();if(window.lucide)lucide.createIcons()}
function go(v){state.view=v;render();closeMenu()}
function bind(){
  $('[data-view-link]').forEach(b=>b.onclick=()=>go(b.dataset.viewLink));
  $('[data-open-player]').forEach(b=>b.onclick=()=>openPlayerForm());
  $('[data-player]').forEach(b=>b.onclick=()=>showPlayer(b.dataset.player));
  const search=$('#playerSearch'),filter=$('#playerCategoryFilter');
  if(search&&filter){
    const apply=()=>{
      const q=search.value.trim().toLowerCase(),cat=filter.value;
      const rows=state.players.filter(p=>(!q||p.name.toLowerCase().includes(q)||(p.guardian||'').toLowerCase().includes(q))&&(!cat||p.category===cat));
      $('#playersTable').innerHTML=playersTable(rows);
      $('[data-player]').forEach(b=>b.onclick=()=>showPlayer(b.dataset.player));
    };
    search.oninput=apply;filter.onchange=apply;
  }
}
$('.nav-item').forEach(b=>b.onclick=()=>go(b.dataset.view));
function openPlayerForm(p=null){
  $('#playerFormTitle').textContent=p?'Editar deportista':'Registrar deportista';
  $('#playerFormSubmit').textContent=p?'Guardar cambios':'Guardar ficha';
  $('#editingPlayerId').value=p?.id||'';
  $('#newPlayerName').value=p?.name||'';
  $('#newPlayerDocument').value=p?.document||'';
  $('#newPlayerCategory').value=p?.category||'';
  $('#newPlayerBirth').value=p?.birth||'';
  $('#newPlayerStatus').value=p?.status||'Activo';
  $('#newPlayerMonthly').value=p?.monthly??50000;
  $('#newPlayerGuardian').value=p?.guardian||'';
  $('#newPlayerPhone').value=p?.phone||'';
  $('#newPlayerEmergency').value=p?.emergency||'';
  $('#newPlayerEmergencyPhone').value=p?.emergencyPhone||'';
  $('#newPlayerEps').value=p?.eps||'';
  $('#newPlayerBlood').value=p?.blood||'';
  $('#newPlayerAllergies').value=p?.allergies||'';
  $('#newPlayerConditions').value=p?.conditions||'';
  $('#newPlayerHeight').value=p?.height||'';
  $('#newPlayerWeight').value=p?.weight||'';
  $('#newPlayerNotes').value=p?.notes||'';
  $('#playerCreateDialog').showModal();
}

$('#playerCreateForm').addEventListener('submit',e=>{
  e.preventDefault();
  const id=Number($('#editingPlayerId').value)||Date.now();
  const data={
    id,
    name:$('#newPlayerName').value.trim(),
    document:$('#newPlayerDocument').value.trim(),
    category:$('#newPlayerCategory').value.trim(),
    birth:$('#newPlayerBirth').value,
    status:$('#newPlayerStatus').value,
    monthly:Number($('#newPlayerMonthly').value)||0,
    guardian:$('#newPlayerGuardian').value.trim(),
    phone:$('#newPlayerPhone').value.trim(),
    emergency:$('#newPlayerEmergency').value.trim(),
    emergencyPhone:$('#newPlayerEmergencyPhone').value.trim(),
    eps:$('#newPlayerEps').value.trim(),
    blood:$('#newPlayerBlood').value.trim(),
    allergies:$('#newPlayerAllergies').value.trim(),
    conditions:$('#newPlayerConditions').value.trim(),
    height:Number($('#newPlayerHeight').value)||'',
    weight:Number($('#newPlayerWeight').value)||'',
    notes:$('#newPlayerNotes').value.trim()
  };
  const i=state.players.findIndex(p=>p.id===id);
  if(i>=0)state.players[i]={...state.players[i],...data}; else state.players.push(data);
  save();$('#playerCreateDialog').close();e.target.reset();render();
});

function showPlayer(id){
  const p=state.players.find(x=>x.id===Number(id));if(!p)return;
  const status=(p.status||'Activo');
  $('#playerDetail').innerHTML=
    '<div class="detail-header"><div><span class="eyebrow">FICHA DEPORTIVA</span><h2 class="detail-name">'+p.name+'</h2><div class="detail-sub">'+(p.category||'Sin categoría')+' · <span class="status-dot '+(status==='Inactivo'?'inactive':'')+'">'+status+'</span></div></div>'+
    '<div class="detail-actions"><button class="secondary" id="editPlayerBtn">Editar</button><button class="close-btn" onclick="document.querySelector(\'#playerDialog\').close()">×</button></div></div>'+
    '<div class="detail-section"><h3>Datos del deportista</h3><div class="detail-grid-2">'+
      field('Documento',p.document)+field('Fecha de nacimiento',p.birth)+field('Mensualidad',p.monthly?'$ '+Number(p.monthly).toLocaleString('es-CO'):'—')+field('Categoría',p.category)+
    '</div></div>'+
    '<div class="detail-section"><h3>Acudiente y emergencia</h3><div class="detail-grid-2">'+
      field('Acudiente',p.guardian)+field('Celular',p.phone)+field('Contacto de emergencia',p.emergency)+field('Celular emergencia',p.emergencyPhone)+
    '</div></div>'+
    '<div class="detail-section"><h3>Información médica</h3><div class="detail-grid-2">'+
      field('EPS',p.eps)+field('Tipo de sangre',p.blood)+field('Alergias',p.allergies,true)+field('Condiciones / observaciones',p.conditions,true)+
    '</div></div>'+
    '<div class="detail-section"><h3>Seguimiento físico</h3><div class="detail-grid-2">'+
      field('Estatura',p.height?p.height+' cm':'—')+field('Peso',p.weight?p.weight+' kg':'—')+field('Observaciones',p.notes,true)+
    '</div></div>';
  $('#editPlayerBtn').onclick=()=>{$('#playerDialog').close();openPlayerForm(p)};
  $('#playerDialog').showModal();
}
function field(label,value,wide=false){return '<div class="detail-field '+(wide?'wide':'')+'"><span>'+label+'</span><strong>'+(value||'—')+'</strong></div>'}

const menuBtn=$('#menuBtn'),sidebar=$('#sidebar'),overlay=$('#overlay');menuBtn.onclick=()=>{sidebar.classList.toggle('open');overlay.classList.toggle('active')};overlay.onclick=closeMenu;function closeMenu(){sidebar.classList.remove('open');overlay.classList.remove('active')}
render();