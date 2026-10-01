import { getChatGPTUser } from '../../chatgpt-auth';
import { member } from '../../../lib/club/service';
import { setCredentials,authenticate,sessionCookie } from '../../../lib/club/auth';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 try{
  const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return new Response('Origen no válido',{status:403});
  const access=await getChatGPTUser();if(!access)return new Response('Configuración no autorizada',{status:403});
  const m:any=await member(access);if(!m.owner)return new Response('Configuración no autorizada',{status:403});
  const form=await req.formData(),username=String(form.get('username')||''),password=String(form.get('password')||''),confirm=String(form.get('confirm')||'');
  if(password!==confirm)return new Response(null,{status:303,headers:{Location:'/?setup_error=Las%20contrase%C3%B1as%20no%20coinciden'}});
  await setCredentials(m.id,username,password);
  const result=await authenticate(username,password);if(!result.ok)throw new Error('No se pudo iniciar la sesión');
  return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':sessionCookie(result.token),'Cache-Control':'no-store'}});
 }catch(e){const msg=e instanceof Error?e.message:'No se pudo crear el acceso';return new Response(null,{status:303,headers:{Location:'/?setup_error='+encodeURIComponent(msg),'Cache-Control':'no-store'}});}
}
