const money=(n:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
const dateText=(d:string)=>d?d.split('-').reverse().join('/'):'—';

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

export function receiptPdf(p:any,lines:any[],currentBalance:number){
  const rows=[
    ['GARCIA HERREROS FC',''],
    ['COMPROBANTE DE PAGO','GH-'+String(p.id).padStart(6,'0')],
    ['Deportista',p.athlete_name],
    ['Fecha del pago',dateText(p.paid_date)],
    ['Recibido de',p.payer],
    ['Medio de pago',p.method+(p.reference?' · Ref. '+p.reference:'')],
    ...lines.map(l=>[(l.kind==='mensualidad'?'Mensualidad':l.kind==='inscripcion'?'Inscripcion':l.kind==='practica'?'Practica':l.kind)+' · '+l.period,money(Number(l.amount))]),
    ['TOTAL RECIBIDO',money(Number(p.amount))],
    ['Saldo actual de la cuenta',money(currentBalance)],
    ['Registrado por',p.recorder||'Administracion'],
    ['Estado',p.status==='void'?'ANULADO':'PAGO CONFIRMADO']
  ];
  const content:string[]=['BT','/F1 15 Tf','50 790 Td'];
  rows.forEach((r,i)=>{
    if(i===0){content.push('('+pdfEsc(r[0])+') Tj','0 -26 Td','/F1 10 Tf','(CLUB DE FUTBOL) Tj','0 -34 Td','/F1 12 Tf');return;}
    const label=r[1]?r[0]+': '+r[1]:r[0];
    content.push('('+pdfEsc(label)+') Tj','0 -24 Td');
    if(i===1)content.push('/F1 10 Tf');
  });
  content.push('0 -12 Td','(Constancia interna del dinero registrado por el club.) Tj','0 -18 Td','(Gracias por apoyar la formacion deportiva.) Tj','ET');
  const stream=content.join('\n');
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  ];
  let pdf='%PDF-1.4\n',offsets=[0];
  objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n';});
  const xref=pdf.length;
  pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
  for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  return new TextEncoder().encode(pdf);
}

export function bytesToBase64(bytes:Uint8Array){
  let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
