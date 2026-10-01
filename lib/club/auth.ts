import { headers } from 'next/headers';
import { db } from './db';

const COOKIE='ghfc_session';
const ITERATIONS=210000;
const SESSION_SECONDS=60*60*12;

const enc=new TextEncoder();
const toHex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const randomHex=(n:number)=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return toHex(b)};
const sha256=async (value:string)=>toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))));
const passwordHash=async(password:string,salt:string,iterations=ITERATIONS)=>{
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations},key,256);
 return toHex(new Uint8Array(bits));
};
const safeEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0};
export const normalizeUsername=(value:string)=>value.trim().toLowerCase();
export function validateUsername(value:string){
 const u=normalizeUsername(value);
 if(!/^[a-z0-9._-]{3,40}$/.test(u))throw new Error('El usuario debe tener entre 3 y 40 caracteres y usar solo letras, números, punto, guion o guion bajo.');
 return u;
}
export function validatePassword(value:string){
 if(typeof value!=='string'||value.length<10||value.length>128||!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(value)||!/[0-9]/.test(value))throw new Error('La contraseña debe tener entre 10 y 128 caracteres e incluir al menos una letra y un número.');
 return value;
}
export async function setCredentials(staffId:string,username:string,password:string){
 const u=validateUsername(username),p=validatePassword(password),database=db();
 const duplicate:any=await database.prepare('SELECT id FROM staff WHERE username=? AND id<>?').bind(u,staffId).first();
 if(duplicate)throw new Error('Ese nombre de usuario ya está asignado.');
 const salt=randomHex(16),hash=await passwordHash(p,salt,ITERATIONS),now=new Date().toISOString();
 await database.batch([
  database.prepare('UPDATE staff SET username=?,password_hash=?,password_salt=?,password_iterations=?,password_updated_at=? WHERE id=?').bind(u,hash,salt,ITERATIONS,now,staffId),
  database.prepare('DELETE FROM auth_sessions WHERE staff_id=?').bind(staffId)
 ]);
 return u;
}
export async function authenticate(username:string,password:string){
 const u=normalizeUsername(username),database=db();
 const row:any=await database.prepare('SELECT * FROM staff WHERE username=? AND active=1').bind(u).first();
 if(!row?.password_hash||!row?.password_salt){
  await passwordHash(String(password||''),'00000000000000000000000000000000',ITERATIONS);
  return null;
 }
 const hash=await passwordHash(String(password||''),row.password_salt,Number(row.password_iterations)||ITERATIONS);
 if(!safeEqual(hash,row.password_hash))return null;
 const token=randomHex(32),tokenHash=await sha256(token),id=crypto.randomUUID(),now=new Date(),expires=new Date(now.getTime()+SESSION_SECONDS*1000);
 await database.batch([
  database.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').bind(now.toISOString()),
  database.prepare('INSERT INTO auth_sessions(id,staff_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)').bind(id,row.id,tokenHash,expires.toISOString(),now.toISOString(),now.toISOString())
 ]);
 return {staff:row,token,expires};
}
function cookieValue(cookie:string|undefined,name:string){
 if(!cookie)return null;
 for(const part of cookie.split(';')){const [k,...rest]=part.trim().split('=');if(k===name)return decodeURIComponent(rest.join('='));}
 return null;
}
export async function getLocalUser(){
 const h=await headers(),token=cookieValue(h.get('cookie')||undefined,COOKIE);
 if(!token)return null;
 const tokenHash=await sha256(token),database=db(),now=new Date().toISOString();
 const row:any=await database.prepare('SELECT staff.*,auth_sessions.id AS session_id,auth_sessions.expires_at FROM auth_sessions JOIN staff ON staff.id=auth_sessions.staff_id WHERE auth_sessions.token_hash=? AND auth_sessions.expires_at>? AND staff.active=1').bind(tokenHash,now).first();
 if(!row)return null;
 return row;
}
export async function logoutLocal(){
 const h=await headers(),token=cookieValue(h.get('cookie')||undefined,COOKIE);
 if(token)await db().prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await sha256(token)).run();
}
export function sessionCookie(token:string,maxAge=SESSION_SECONDS){return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
export function clearSessionCookie(){return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
export async function ownerNeedsSetup(){
 const row:any=await db().prepare("SELECT username,password_hash FROM staff WHERE owner=1 LIMIT 1").first();
 return !row?.username||!row?.password_hash;
}
