import { logoutLocal,clearSessionCookie } from '../../../lib/club/auth';
export const dynamic='force-dynamic';
export async function GET(){await logoutLocal();return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':clearSessionCookie(),'Cache-Control':'no-store'}});}
