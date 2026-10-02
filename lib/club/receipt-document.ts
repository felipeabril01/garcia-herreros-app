const money=(n:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
const dateText=(d:string)=>d?d.split('-').reverse().join('/'):'—';
const todayBogota=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const COLORS={blue:'#124bdf',navy:'#14254b',muted:'#596a85',line:'#dbe3f0',soft:'#f4f7fc',softBlue:'#edf3ff',green:'#167052',red:'#bb3947'};

function htmlEsc(v:any){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
function concept(l:any){return ({mensualidad:'Mensualidad',inscripcion:'Inscripción',practica:'Práctica'} as Record<string,string>)[l.kind]||String(l.kind||'Concepto')}

export type ReceiptLine={label:string;amount:number};
export type ReceiptModel={
  number:string; status:'confirmed'|'void'; statusLabel:string; athlete:string; paidDate:string;
  payer:string; method:string; reference:string; lines:ReceiptLine[]; total:number; recorder:string;
  currentBalance:number; consultedDate:string; voidReason:string;
};

export function buildReceiptModel(p:any,lines:any[],currentBalance:number):ReceiptModel{
  return {
    number:'GH-'+String(p.id).padStart(6,'0'),
    status:p.status==='void'?'void':'confirmed',
    statusLabel:p.status==='void'?'ANULADO':'PAGO CONFIRMADO',
    athlete:String(p.athlete_name||''),
    paidDate:dateText(String(p.paid_date||'')),
    payer:String(p.payer||''),
    method:String(p.method||'')+(p.reference?' · Ref. '+String(p.reference):''),
    reference:String(p.reference||''),
    lines:lines.map(l=>({label:concept(l)+' · '+String(l.period||''),amount:Number(l.amount||0)})),
    total:Number(p.amount||0),
    recorder:String(p.recorder||'Administración'),
    currentBalance:Number(currentBalance||0),
    consultedDate:dateText(todayBogota()),
    voidReason:String(p.void_reason||'')
  };
}

export function receiptHtml(m:ReceiptModel){
  return '<article class="receipt institutional-receipt">'+
    '<div class="receipt-brand"><img src="/escudo.jpeg" alt="Escudo García Herreros FC" width="76" height="96"><div>'+
    '<div class="receipt-club">GARCÍA HERREROS FC</div><p>CLUB DE FÚTBOL</p><p class="receipt-email">cdgarciaherrerosfc2014@gmail.com</p></div></div>'+
    '<div class="receipt-heading"><div><span class="receipt-label">COMPROBANTE DE PAGO</span><h2>'+htmlEsc(m.number)+'</h2></div>'+
    '<span class="receipt-status '+(m.status==='void'?'is-void':'')+'">'+htmlEsc(m.statusLabel)+'</span></div>'+
    '<div class="receipt-details"><div><span class="receipt-label">DEPORTISTA</span><strong>'+htmlEsc(m.athlete)+'</strong></div>'+
    '<div><span class="receipt-label">FECHA DEL PAGO</span><strong>'+htmlEsc(m.paidDate)+'</strong></div>'+
    '<div><span class="receipt-label">RECIBIDO DE</span><strong>'+htmlEsc(m.payer)+'</strong></div>'+
    '<div><span class="receipt-label">MEDIO DE PAGO</span><strong>'+htmlEsc(m.method)+'</strong></div></div>'+
    '<table class="receipt-table"><thead><tr><th>Concepto y periodo</th><th>Valor recibido</th></tr></thead><tbody>'+
    m.lines.map(l=>'<tr><td>'+htmlEsc(l.label)+'</td><td>'+money(l.amount)+'</td></tr>').join('')+
    '</tbody></table><div class="receipt-total"><span>TOTAL RECIBIDO <small>Pesos colombianos · COP</small></span><strong>'+money(m.total)+'</strong></div>'+
    (m.status==='void'?'<div class="receipt-void"><strong>COMPROBANTE ANULADO</strong><p>'+htmlEsc(m.voidReason)+'</p></div>':'')+
    '<div class="receipt-record"><div><span class="receipt-label">REGISTRADO POR</span><strong>'+htmlEsc(m.recorder)+'</strong></div>'+
    '<div><span class="receipt-label">SALDO ACTUAL DE LA CUENTA</span><strong>'+money(m.currentBalance)+'</strong><small>Consultado el '+htmlEsc(m.consultedDate)+'</small></div></div>'+
    '<div class="receipt-foot"><strong>García Herreros FC</strong><p>Constancia interna del dinero registrado por el club.</p><p>Gracias por apoyar la formación deportiva.</p></div></article>';
}

function pdfEsc(value:string){
  const normalized=String(value??'').replace(/[\r\n]+/g,' ');
  let out='';
  for(const ch of normalized){
    const code=ch.charCodeAt(0);
    if(ch==='\\'||ch==='('||ch===')')out+='\\'+ch;
    else if(code>=32&&code<=126)out+=ch;
    else if(code<=255)out+='\\'+code.toString(8).padStart(3,'0');
    else out+='?';
  }
  return out;
}
const hexToRgb=(hex:string)=>{const n=parseInt(hex.slice(1),16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]};
const rgb=(hex:string)=>hexToRgb(hex).map(n=>n.toFixed(3)).join(' ');
const txt=(x:number,y:number,size:number,text:string,bold=false,color=COLORS.navy)=>'BT '+rgb(color)+' rg /'+(bold?'F2':'F1')+' '+size+' Tf 1 0 0 1 '+x+' '+y+' Tm ('+pdfEsc(text)+') Tj ET';
const rect=(x:number,y:number,w:number,h:number,color:string)=>'q '+rgb(color)+' rg '+x+' '+y+' '+w+' '+h+' re f Q';
const stroke=(x1:number,y1:number,x2:number,y2:number,color:string,width=1)=>'q '+rgb(color)+' RG '+width+' w '+x1+' '+y1+' m '+x2+' '+y2+' l S Q';

function jpegSize(bytes:Uint8Array){
  if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8)return null;
  let i=2;
  while(i+9<bytes.length){
    if(bytes[i]!==0xff){i++;continue}
    const marker=bytes[i+1];i+=2;
    if(marker===0xd9||marker===0xda)break;
    const len=(bytes[i]<<8)|bytes[i+1];
    if(len<2||i+len>bytes.length)break;
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
      return {height:(bytes[i+3]<<8)|bytes[i+4],width:(bytes[i+5]<<8)|bytes[i+6]};
    }
    i+=len;
  }
  return null;
}
const enc=(s:string)=>new TextEncoder().encode(s);
const concat=(parts:Uint8Array[])=>{const n=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out};

function buildPdf(content:string,logo?:Uint8Array){
  const c=enc(content),info=logo?jpegSize(logo):null,useLogo=!!(logo&&info);
  const resources='<< /Font << /F1 5 0 R /F2 6 0 R >>'+(useLogo?' /XObject << /Im1 7 0 R >>':'')+' >>';
  const objects:Uint8Array[]=[
    enc('<< /Type /Catalog /Pages 2 0 R >>'),
    enc('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    enc('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources '+resources+' /Contents 4 0 R >>'),
    concat([enc('<< /Length '+c.length+' >>\nstream\n'),c,enc('\nendstream')]),
    enc('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    enc('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  ];
  if(useLogo&&logo&&info)objects.push(concat([enc('<< /Type /XObject /Subtype /Image /Width '+info.width+' /Height '+info.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+logo.length+' >>\nstream\n'),logo,enc('\nendstream')]));
  const parts:Uint8Array[]=[enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offsets=[0];let length=parts[0].length;
  objects.forEach((o,i)=>{offsets.push(length);const b=concat([enc((i+1)+' 0 obj\n'),o,enc('\nendobj\n')]);parts.push(b);length+=b.length});
  const xref=length;let table='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
  for(let i=1;i<offsets.length;i++)table+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  table+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  parts.push(enc(table));return concat(parts);
}

export function receiptPdf(m:ReceiptModel,logo?:Uint8Array){
  const c:string[]=[];
  c.push(rect(42,793,511,7,COLORS.blue));
  if(logo&&jpegSize(logo))c.push('q 54 0 0 68 50 704 cm /Im1 Do Q');
  c.push(txt(120,763,18,'GARCÍA HERREROS FC',true),txt(120,740,10,'CLUB DE FÚTBOL',false,COLORS.muted),txt(120,721,9,'cdgarciaherrerosfc2014@gmail.com',false,COLORS.muted));
  c.push(stroke(50,696,545,696,COLORS.line));
  c.push(txt(50,668,9,'COMPROBANTE DE PAGO',true,COLORS.muted),txt(50,642,22,m.number,true,COLORS.blue));
  c.push('q '+rgb(m.status==='void'?COLORS.red:COLORS.green)+' RG 1 w 415 640 130 28 re S Q',txt(430,650,9,m.statusLabel,true,m.status==='void'?COLORS.red:COLORS.green));
  c.push(rect(50,525,495,92,COLORS.soft));
  c.push(txt(68,590,8,'DEPORTISTA',true,COLORS.muted),txt(68,572,11,m.athlete,true),txt(325,590,8,'FECHA DEL PAGO',true,COLORS.muted),txt(325,572,11,m.paidDate,true));
  c.push(txt(68,548,8,'RECIBIDO DE',true,COLORS.muted),txt(68,530,11,m.payer,true),txt(325,548,8,'MEDIO DE PAGO',true,COLORS.muted),txt(325,530,11,m.method,true));
  let y=490;c.push(rect(50,y,495,30,COLORS.navy),txt(62,y+10,9,'CONCEPTO Y PERIODO',true,'#ffffff'),txt(455,y+10,9,'VALOR RECIBIDO',true,'#ffffff'));
  y-=32;
  for(const line of m.lines){
    c.push(txt(62,y+10,10,line.label,false),txt(455,y+10,10,money(line.amount),true));
    c.push(stroke(50,y,545,y,COLORS.line));y-=32;
  }
  c.push(rect(50,y-12,495,56,COLORS.softBlue),txt(62,y+17,10,'TOTAL RECIBIDO',true),txt(62,y+2,8,'Pesos colombianos · COP',false,COLORS.muted),txt(430,y+8,20,money(m.total),true));
  y-=78;
  if(m.status==='void'){c.push('q '+rgb(COLORS.red)+' RG 1.5 w 50 '+(y-10)+' 495 46 re S Q',txt(62,y+16,10,'COMPROBANTE ANULADO',true,COLORS.red),txt(62,y,9,m.voidReason,false,COLORS.red));y-=64}
  c.push(txt(62,y,8,'REGISTRADO POR',true,COLORS.muted),txt(62,y-18,10,m.recorder,true),txt(325,y,8,'SALDO ACTUAL DE LA CUENTA',true,COLORS.muted),txt(325,y-18,10,money(m.currentBalance),true),txt(325,y-32,8,'Consultado el '+m.consultedDate,false,COLORS.muted));
  y-=62;c.push(stroke(50,y,545,y,COLORS.line),txt(236,y-23,10,'García Herreros FC',true),txt(164,y-40,8,'Constancia interna del dinero registrado por el club.',false,COLORS.muted),txt(196,y-54,8,'Gracias por apoyar la formación deportiva.',false,COLORS.muted));
  return buildPdf(c.join('\n'),logo);
}

export function bytesToBase64(bytes:Uint8Array){
  let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
