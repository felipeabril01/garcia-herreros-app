import { getLocalUser,setCredentials,authenticate,sessionCookie,clearSessionCookie } from '../../../lib/club/auth';
import { db } from '../../../lib/club/db';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 try{
  const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return new Response('Origen no válido',{status:403});
  const user:any=await getLocalUser();if(!user)return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':clearSessionCookie()}});
  const form=await req.formData(),password=String(form.get('password')||''),confirm=String(form.get('confirm')||'');
  if(password!==confirm)return new Response(null,{status:303,headers:{Location:'/?force_error='+encodeURIComponent('Las contraseñas no coinciden.'),'Cache-Control':'no-store'}});
  await setCredentials(user.id,user.username,password,false);
  await db().prepare('INSERT INTO audit(id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),user.id,'password_changed_first_login',user.id,new Date().toISOString()).run();
  const result=await authenticate(user.username,password);if(!result.ok)throw new Error('No se pudo iniciar la sesión');
  return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':sessionCookie(result.token),'Cache-Control':'no-store'}});
 }catch(e){
  const msg=e instanceof Error?e.message:'No se pudo cambiar la contraseña';
  return new Response(null,{status:303,headers:{Location:'/?force_error='+encodeURIComponent(msg),'Cache-Control':'no-store'}});
 }
}
