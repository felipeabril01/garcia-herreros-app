import { getLocalUser } from '../../../lib/club/auth';
import { member,handle,HttpError } from '../../../lib/club/service';
export const dynamic='force-dynamic';
async function respond(req:Request){try{
 const user:any=await getLocalUser();if(!user)return Response.json({error:'Inicia sesión para continuar.'},{status:401,headers:{'Cache-Control':'no-store'}});
 if(!['GET','HEAD'].includes(req.method)){const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return Response.json({error:'Origen de la solicitud no válido.'},{status:403});if(!req.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Formato no válido.'},{status:415});}
 const m=await member({staffId:user.id}),path=new URL(req.url).pathname.split('/').slice(2).map(decodeURIComponent);let body={};
 if(req.method!=='GET'){const raw=await req.text();if(raw.length>30000)return Response.json({error:'Solicitud demasiado grande.'},{status:413});try{body=JSON.parse(raw)}catch{return Response.json({error:'Contenido inválido.'},{status:400})}}
 const result=await handle(req.method,path,body,m);return Response.json(result,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){if(e instanceof HttpError)return Response.json({error:e.message},{status:e.status,headers:{'Cache-Control':'no-store'}});console.error('Club API',e instanceof Error?e.message:'Unknown error');const duplicate=e instanceof Error&&e.message.includes('UNIQUE constraint');return Response.json({error:duplicate?'Ese documento o correo ya está registrado.':'No se pudo completar la operación. Tus datos no se han confirmado; vuelve a intentarlo.'},{status:duplicate?409:503,headers:{'Cache-Control':'no-store'}});}}
export const GET=respond;export const POST=respond;export const PUT=respond;export const DELETE=respond;
