const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const baseStyle=`
:root{--blue:#124bdf;--navy:#14254b;--muted:#68758c;--line:#e5eaf2;--bg:#f4f6fa}
*{box-sizing:border-box}body{margin:0;background:var(--bg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--navy);min-height:100vh;display:grid;place-items:center;padding:24px}
.login{width:min(440px,100%);background:white;border:1px solid var(--line);border-radius:18px;padding:32px;box-shadow:0 25px 80px #14254b18}
.brand{display:flex;align-items:center;gap:14px;margin-bottom:28px}.brand img{width:55px;height:72px;object-fit:contain}.brand strong{font-size:18px;display:block}.brand span{font-size:11px;letter-spacing:2px;color:var(--muted)}
h1{font-size:26px;margin:0 0 8px}p{color:var(--muted);margin:0 0 22px;line-height:1.5}
label{display:block;font-size:14px;font-weight:650;margin:15px 0 7px}input{width:100%;border:1px solid #dbe2ee;border-radius:9px;padding:12px 13px;font-size:16px;color:var(--navy)}.password-wrap{position:relative}.password-wrap input{padding-right:48px}.toggle-pass{position:absolute;right:7px;top:50%;transform:translateY(-50%);width:36px;height:36px;margin:0;padding:0;border:0;background:transparent;color:var(--muted);display:grid;place-items:center}.toggle-pass svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
button{width:100%;border:0;border-radius:9px;padding:13px 16px;margin-top:22px;background:var(--blue);color:white;font-size:15px;font-weight:700;cursor:pointer}
.notice{padding:12px 14px;border-radius:8px;background:#fff4df;color:#8a5c12;font-size:13px;margin-bottom:18px}.hint{font-size:12px;color:var(--muted);margin-top:14px}.foot{text-align:center;font-size:12px;color:#8b95a8;margin-top:24px}
`;
export function loginPage(error=''){
 return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Ingresar · García Herreros FC</title><style>${baseStyle}</style></head><body><main class="login"><div class="brand"><img src="/escudo.jpeg" alt="Escudo García Herreros FC"><div><strong>GARCÍA HERREROS</strong><span>FÚTBOL CLUB</span></div></div><h1>Ingresar</h1><p>Acceso privado para personal autorizado del club.</p>${error?`<div class="notice">${esc(error)}</div>`:''}<form method="post" action="/auth/login"><label for="username">Usuario</label><input id="username" name="username" autocomplete="username" required maxlength="40"><label for="password">Contraseña</label><div class="password-wrap"><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="128"><button class="toggle-pass" type="button" aria-label="Mostrar contraseña" onclick="togglePassword('password',this)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div><button type="submit">Ingresar</button></form><div class="foot">García Herreros FC · Gestión del club</div></main><script>
function togglePassword(id,btn){
 const input=document.getElementById(id);if(!input)return;
 const show=input.type==='password';input.type=show?'text':'password';
 btn.setAttribute('aria-label',show?'Ocultar contraseña':'Mostrar contraseña');
 btn.innerHTML=show
 ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 5a16.4 16.4 0 0 1-2.3 2.9M6.6 6.6C4.3 8.1 3 10 3 10s3.5 5 9 5c1.2 0 2.3-.2 3.3-.6"/></svg>'
 : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
}
</script></body></html>`;
}
export function setupPage(error=''){
 return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Crear acceso administrador · García Herreros FC</title><style>${baseStyle}</style></head><body><main class="login"><div class="brand"><img src="/escudo.jpeg" alt="Escudo García Herreros FC"><div><strong>GARCÍA HERREROS</strong><span>FÚTBOL CLUB</span></div></div><h1>Crear tu acceso</h1><p>Vamos a reemplazar el ingreso de Cloudflare por un usuario y contraseña propios del club.</p><div class="notice">Este paso solo crea las credenciales del responsable inicial. No desactives Cloudflare Access todavía.</div>${error?`<div class="notice">${esc(error)}</div>`:''}<form method="post" action="/auth/setup"><label for="username">Tu nombre de usuario</label><input id="username" name="username" autocomplete="username" required maxlength="40" placeholder="felipeabril"><label for="password">Nueva contraseña</label><div class="password-wrap"><input id="password" name="password" type="password" autocomplete="new-password" required maxlength="128"><button class="toggle-pass" type="button" aria-label="Mostrar contraseña" onclick="togglePassword('password',this)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div><label for="confirm">Confirmar contraseña</label><div class="password-wrap"><input id="confirm" name="confirm" type="password" autocomplete="new-password" required maxlength="128"><button class="toggle-pass" type="button" aria-label="Mostrar contraseña" onclick="togglePassword('confirm',this)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div><button type="submit">Crear acceso seguro</button></form><div class="hint">Mínimo 10 caracteres, con al menos una letra y un número.</div></main><script>
function togglePassword(id,btn){
 const input=document.getElementById(id);if(!input)return;
 const show=input.type==='password';input.type=show?'text':'password';
 btn.setAttribute('aria-label',show?'Ocultar contraseña':'Mostrar contraseña');
 btn.innerHTML=show
 ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5 9 5a16.4 16.4 0 0 1-2.3 2.9M6.6 6.6C4.3 8.1 3 10 3 10s3.5 5 9 5c1.2 0 2.3-.2 3.3-.6"/></svg>'
 : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
}
</script></body></html>`;
}
