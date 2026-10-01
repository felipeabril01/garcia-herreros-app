import { authenticate,sessionCookie } from '../../../lib/club/auth';
export const dynamic='force-dynamic';
const bad=()=>new Response(null,{status:303,headers:{Location:'/?error=Usuario%20o%20contrase%C3%B1a%20incorrectos','Cache-Control':'no-store'}});
export async function POST(req:Request){
 try{
  const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return new Response('Origen no válido',{status:403});
  const form=await req.formData(),username=String(form.get('username')||''),password=String(form.get('password')||'');
  const result=await authenticate(username,password);if(!result)return bad();
  return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':sessionCookie(result.token),'Cache-Control':'no-store'}});
 }catch{return bad();}
}
