import { authenticate,sessionCookie } from '../../../lib/club/auth';
export const dynamic='force-dynamic';
const redirectError=(msg:string)=>new Response(null,{status:303,headers:{Location:'/?error='+encodeURIComponent(msg),'Cache-Control':'no-store'}});
export async function POST(req:Request){
 try{
  const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return new Response('Origen no válido',{status:403});
  const form=await req.formData(),username=String(form.get('username')||''),password=String(form.get('password')||'');
  const result=await authenticate(username,password);
  if(!result.ok){
   if(result.reason==='locked')return redirectError('Demasiados intentos fallidos. La cuenta quedó bloqueada temporalmente durante 15 minutos.');
   return redirectError('Usuario o contraseña incorrectos');
  }
  return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':sessionCookie(result.token),'Cache-Control':'no-store'}});
 }catch{return redirectError('No se pudo iniciar sesión. Inténtalo nuevamente.');}
}
