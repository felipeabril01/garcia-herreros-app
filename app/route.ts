import { getChatGPTUser } from './chatgpt-auth';
import { getLocalUser,ownerNeedsSetup } from '../lib/club/auth';
import { member,HttpError } from '../lib/club/service';
import { loginPage,setupPage,forcePasswordPage } from '../lib/club/login-pages';
import { shell } from '../lib/club/shell';
export const dynamic='force-dynamic';
const htmlHeaders={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
export async function GET(req:Request){
 try{
  const local:any=await getLocalUser();
  if(local){await member({staffId:local.id});const url=new URL(req.url);if(local.must_change_password)return new Response(forcePasswordPage(url.searchParams.get('force_error')||''),{headers:htmlHeaders});return new Response(shell,{headers:htmlHeaders});}
  const url=new URL(req.url),access=await getChatGPTUser();
  if(access){
   try{
    const m:any=await member(access);
    if(m.owner&&await ownerNeedsSetup())return new Response(setupPage(url.searchParams.get('setup_error')||''),{headers:htmlHeaders});
   }catch{}
  }
  return new Response(loginPage(url.searchParams.get('error')||''),{headers:htmlHeaders});
 }catch(e){
  const status=e instanceof HttpError?e.status:503;
  return new Response(loginPage(status===403?'Tu usuario está desactivado o no tiene acceso.':'No pudimos abrir la base del club. Vuelve a intentarlo.'),{status,headers:htmlHeaders});
 }
}
