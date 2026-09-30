
export const CLUB={administration:[{role:'Presidente',name:'Vicente Sánchez'},{role:'Vicepresidenta',name:'Por definir'},{role:'Secretaria',name:'Sandra González'},{role:'Coordinador',name:'Felipe Abril'}],venues:{prosperidad:'Cancha sintética La Prosperidad',beraka:'Cancha de tierra Beraka'},categories:['2022–2023','2020–2021','2018–2019','2016–2017','2014–2015','2012–2013','2008–2011'],coaches:[{id:'yormary',name:'Yormary Montes',rate:40000},{id:'diego',name:'Diego García',rate:40000},{id:'carlosabril',name:'Carlos Abril',rate:40000},{id:'ramon',name:'Ramón Pita',rate:40000},{id:'mateo',name:'Mateo Rincón',rate:40000},{id:'jorge',name:'Jorge Montes',rate:50000},{id:'felipe',name:'Felipe Abril',rate:50000},{id:'carloshurtado',name:'Carlos Hurtado',rate:40000},{id:'edgar',name:'Edgar Montes',rate:40000}]};
export const WEEKDAYS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
export const weeklySessions: any[]=[];
function addWeekly(category:string,days:number[],venue:string,coaches:string[],start='19:00',end='20:30'){for(const day of days)weeklySessions.push({id:category+'-'+day,category,day,venue,coaches,start,end});}
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

export const CLUB_EMAIL='cdgarciaherrerosfc2014@gmail.com';
export const BOOTSTRAP_EMAIL='felipeabril152@gmail.com';
