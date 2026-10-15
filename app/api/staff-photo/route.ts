import { getLocalUser } from '../../../lib/club/auth';
import { photosBucket, allowedPhotoTypes } from '../../../lib/club/photos';

export const dynamic='force-dynamic';
const key=(id:string)=>'staff/'+id+'/profile';
const auth=async()=>{const user:any=await getLocalUser();return user?.active?user:null};

export async function GET(){
 const user=await auth();
 if(!user)return new Response('No autorizado',{status:401});
 try{
  const obj=await photosBucket().get(key(user.id));
  if(!obj)return new Response('Sin fotografía',{status:404});
  const headers=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  obj.writeHttpMetadata(headers);
  return new Response(obj.body,{headers});
 }catch{return new Response('Fotografía no disponible',{status:503});}
}

export async function POST(req:Request){
 const user=await auth();
 if(!user)return Response.json({error:'Sesión no válida.'},{status:401});
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Origen no válido.'},{status:403});
 try{
  const form=await req.formData(),file=form.get('photo');
  if(!(file instanceof File))return Response.json({error:'Selecciona una foto.'},{status:400});
  if(!allowedPhotoTypes.has(file.type))return Response.json({error:'Usa JPG, PNG o WebP.'},{status:400});
  if(file.size<1||file.size>2*1024*1024)return Response.json({error:'La fotografía debe pesar máximo 2 MB.'},{status:400});
  const bytes=await file.arrayBuffer(),head=new Uint8Array(bytes);
  const jpeg=head.length>=3&&head[0]===0xff&&head[1]===0xd8&&head[2]===0xff;
  const png=head.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>head[i]===b);
  const webp=head.length>=12&&String.fromCharCode(...head.slice(0,4))==='RIFF'&&String.fromCharCode(...head.slice(8,12))==='WEBP';
  if(!((file.type==='image/jpeg'&&jpeg)||(file.type==='image/png'&&png)||(file.type==='image/webp'&&webp)))return Response.json({error:'El archivo no corresponde a una imagen válida.'},{status:400});
  await photosBucket().put(key(user.id),bytes,{httpMetadata:{contentType:file.type}});
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'No fue posible guardar la fotografía en R2.'},{status:503});}
}
