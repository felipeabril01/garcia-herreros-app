'use strict';
const CLUB={administration:[{role:'Presidente',name:'Vicente Sánchez'},{role:'Vicepresidenta',name:'Por definir'},{role:'Secretaria',name:'Sandra González'},{role:'Coordinador',name:'Felipe Abril'}],venues:{prosperidad:'Cancha sintética La Prosperidad',beraka:'Cancha de tierra Beraka'},categories:['2022–2023','2020–2021','2018–2019','2016–2017','2014–2015','2012–2013','2008–2011'],coaches:[{id:'yormary',name:'Yormary Montes'},{id:'diego',name:'Diego García'},{id:'carlosabril',name:'Carlos Abril'},{id:'ramon',name:'Ramón Pita'},{id:'mateo',name:'Mateo Rincón'},{id:'jorge',name:'Jorge Montes'},{id:'felipe',name:'Felipe Abril'},{id:'carloshurtado',name:'Carlos Hurtado'},{id:'edgar',name:'Edgar Montes'}]};
const WEEKDAYS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const weeklySessions=[];
function addWeekly(category,days,venue,coaches,start='19:00',end='20:30'){for(const day of days)weeklySessions.push({id:category+'-'+day,category,day,venue,coaches,start,end});}
addWeekly('2020–2021',[1,3,5],'prosperidad',['yormary']);
addWeekly('2022–2023',[1,3,5],'prosperidad',['diego']);
addWeekly('2018–2019',[1,3,5],'prosperidad',['carlosabril','ramon']);
addWeekly('2016–2017',[2],'beraka',['mateo','felipe']);
addWeekly('2016–2017',[3],'beraka',['mateo','jorge','felipe']);
addWeekly('2016–2017',[5],'prosperidad',['mateo','jorge','felipe']);
addWeekly('2014–2015',[1,2],'beraka',['carloshurtado','edgar']);
addWeekly('2014–2015',[4],'prosperidad',['carloshurtado','edgar']);
addWeekly('2012–2013',[1,4],'beraka',['jorge','felipe']);
addWeekly('2012–2013',[2],'prosperidad',['jorge']);
addWeekly('2008–2011',[1,3,5],'prosperidad',['diego'],'17:30','19:00');
const coachById=id=>CLUB.coaches.find(c=>c.id===id);
const coachCategories=id=>[...new Set(weeklySessions.filter(s=>s.coaches.includes(id)).map(s=>s.category))];
const sessionPay=s=>s.coaches.reduce((sum,id)=>sum+coachById(id).rate,0);
const dateDay=date=>new Date(date+'T12:00:00Z').getUTCDay();
const isoAdd=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
function occurrences(start,end){if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)return [];const out=[];for(let date=start,n=0;date<=end&&n<366;date=isoAdd(date,1),n++)for(const s of weeklySessions.filter(s=>s.day===dateDay(date)))out.push({...s,date,key:date+'_'+s.id});return out;}
