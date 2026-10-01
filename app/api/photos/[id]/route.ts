import { getLocalUser } from '../../../../lib/club/auth';
import { db } from '../../../../lib/club/db';
import { photosBucket,allowedPhotoTypes,MAX_PHOTO_BYTES,photoExtension } from '../../../../lib/club/photos';
import { coachCategories } from '../../../../lib/club/service';

export const dynamic='force-dynamic';

async function context(id:string){
 const user:any=await getLocalUser();
 if(!user)return {error:new Response('No autorizado',{status:401})};
 const database=db();
 const athlete:any=await database.prepare('SELECT id,category,photo_key FROM athletes WHERE id=?').bind(id).first();
 if(!athlete)return {error:new Response('Deportista no encontrado',{status:404})};
 const staff:any=await database.prepare('SELECT id,role,coach_id,active FROM staff WHERE id=?').bind(user.id).first();
 if(!staff?.active)return {error:new Response('No autorizado',{status:401})};
 const canView=staff.role==='admin'||coachCategories(staff.coach_id||'').includes(athlete.category);
 return canView?{user,staff,athlete,database}:{error:new Response('Sin permiso',{status:403})};
}

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params,ctx:any=await context(id);if(ctx.error)return ctx.error;
  if(!ctx.athlete.photo_key)return new Response('Sin foto',{status:404});
  const obj=await photosBucket().get(ctx.athlete.photo_key);if(!obj)return new Response('Sin foto',{status:404});
  const headers=new Headers({'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'});
  obj.writeHttpMetadata(headers);headers.set('etag',obj.httpEtag);
  return new Response(obj.body,{headers});
 }catch{return new Response('Foto no disponible',{status:503});}
}

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return new Response('Origen no válido',{status:403});
  const {id}=await params,ctx:any=await context(id);if(ctx.error)return ctx.error;
  if(ctx.staff.role!=='admin')return new Response('Solo un administrativo puede cambiar fotos',{status:403});
  const form=await req.formData(),file=form.get('photo');
  if(!(file instanceof File))return Response.json({error:'Selecciona una foto.'},{status:400});
  if(!allowedPhotoTypes.has(file.type))return Response.json({error:'Usa una imagen JPG, PNG o WebP.'},{status:400});
  if(file.size<1||file.size>MAX_PHOTO_BYTES)return Response.json({error:'La foto debe pesar máximo 5 MB.'},{status:400});
  const key='athletes/'+id+'/'+crypto.randomUUID()+'.'+photoExtension(file.type);
  const bucket=photosBucket();
  await bucket.put(key,file.stream(),{httpMetadata:{contentType:file.type,cacheControl:'private, max-age=300'}});
  const old=ctx.athlete.photo_key;
  const now=new Date().toISOString();
  await ctx.database.batch([
   ctx.database.prepare('UPDATE athletes SET photo_key=?,updated_at=?,version=version+1 WHERE id=?').bind(key,now,id),
   ctx.database.prepare('INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),ctx.staff.id,'athlete_photo_updated',id,now)
  ]);
  if(old&&old!==key)await bucket.delete(old);
  return Response.json({ok:true,url:'/api/photos/'+encodeURIComponent(id)+'?v='+Date.now()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  return Response.json({error:e instanceof Error&&e.message==='PHOTOS_UNAVAILABLE'?'El almacenamiento de fotos todavía no está conectado.':'No se pudo guardar la foto.'},{status:503});
 }
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return new Response('Origen no válido',{status:403});
  const {id}=await params,ctx:any=await context(id);if(ctx.error)return ctx.error;
  if(ctx.staff.role!=='admin')return new Response('Solo un administrativo puede eliminar fotos',{status:403});
  const key=ctx.athlete.photo_key;if(!key)return Response.json({ok:true});
  const now=new Date().toISOString();
  await ctx.database.batch([
   ctx.database.prepare('UPDATE athletes SET photo_key=NULL,updated_at=?,version=version+1 WHERE id=?').bind(now,id),
   ctx.database.prepare('INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),ctx.staff.id,'athlete_photo_deleted',id,now)
  ]);
  await photosBucket().delete(key);
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'No se pudo eliminar la foto.'},{status:503});}
}
