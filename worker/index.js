import { services } from '../public/catalog.js';
const ASSETS = /*ASSETS*/ {};
const OPEN=540,CLOSE=1020;
// Public booking frontend hosted on Vercel; admin writes remain same-origin.
const CLIENT_ORIGINS = new Set(['https://espacodajuh.vercel.app']);
const DURATIONS=Object.fromEntries(services.map(s=>[s.id,s.minutes]));
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function localNow(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute)};}
function validDate(d){return /^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}
function validOpenDay(d){return validDate(d)&&[3,4,5,6].includes(new Date(d+'T12:00:00Z').getUTCDay());}
function slots(date,duration,entries,now=localNow()){if(!validOpenDay(date)||date<now.date)return [];const result=[];for(let n=OPEN;n+duration<=CLOSE;n+=15){if(date===now.date&&n<=now.minute)continue;if(entries.some(b=>b.active!==0&&b.date===date&&n<b.end&&n+duration>b.start))continue;result.push(`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`);}return result;}
async function authorized(request,env){const email=(request.headers.get('oai-authenticated-user-email')||'').toLowerCase();if(!request.headers.get('oai-authenticated-user-id')||!email)return false;const setting=await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_email'").first();return email===(setting?.value||env.ADMIN_BOOTSTRAP_EMAIL||'').toLowerCase();}
async function body(request){if(Number(request.headers.get('content-length')||0)>5000)throw new Error('Pedido muito grande.');let text=await request.text();if(text.length>5000)throw new Error('Pedido muito grande.');return JSON.parse(text);}
const stamp=()=>new Date().toISOString();
export default {async fetch(request,env){try{
const url=new URL(request.url),p=url.pathname;
if(p.startsWith('/api/')){
if(!env.DB)return json({error:'A agenda está temporariamente indisponível. Tente novamente.'},503);
if(p==='/api/availability'&&request.method==='GET'){
const serviceIds=(url.searchParams.get('services')??url.searchParams.get('service')??'').split(','),date=url.searchParams.get('date');if(serviceIds.length>Object.keys(DURATIONS).length||new Set(serviceIds).size!==serviceIds.length||serviceIds.some(id=>!Object.hasOwn(DURATIONS,id))||!validDate(date||''))return json({error:'Selecione serviços e uma data válidos.'},400);const duration=serviceIds.reduce((sum,id)=>sum+DURATIONS[id],0);
const days=Number(url.searchParams.get('days')||1);if(!Number.isInteger(days)||days<1||days>14)return json({error:'Período inválido.'},400);
const end=new Date(date+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+days-1);const endDate=end.toISOString().slice(0,10);const rows=await env.DB.prepare('SELECT date, start, end, active FROM schedule_entries WHERE active = 1 AND date >= ? AND date <= ?').bind(date,endDate).all();const now=localNow(),dates=[];for(let i=0;i<days;i++){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);const value=d.toISOString().slice(0,10);dates.push({date:value,open:validOpenDay(value),slots:slots(value,duration,rows.results,now)});}return json({days:dates});
}
if(p==='/api/bookings'&&request.method==='POST'){
if(!(request.headers.get('origin')===url.origin||CLIENT_ORIGINS.has(request.headers.get('origin')))||!(request.headers.get('content-type')||'').includes('application/json'))return json({error:'Origem ou formato inválido.'},403);
const b=await body(request),ids=b.services,now=localNow();
if(typeof b.requestId!=='string'||!/^[-a-f0-9]{36}$/.test(b.requestId)||typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>80||!Array.isArray(ids)||ids.length<1||ids.length>services.length||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!Object.hasOwn(DURATIONS,id))||!validOpenDay(b.date||'')||b.date<now.date||typeof b.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time))return json({error:'Confira seu nome, os serviços e um dia de quarta a sábado.'},400);
const [h,m]=b.time.split(':').map(Number),start=h*60+m,duration=ids.reduce((sum,id)=>sum+DURATIONS[id],0),end=start+duration;
if(start<OPEN||end>CLOSE||start%15!==0||(b.date===now.date&&start<=now.minute))return json({error:'Escolha um horário disponível dentro do atendimento.'},400);
const chosen=services.filter(s=>ids.includes(s.id)),serviceData=JSON.stringify(chosen.map(s=>({id:s.id,name:s.name,price:s.price,priceFrom:!!s.priceFrom,minutes:s.minutes}))),total=chosen.reduce((sum,s)=>sum+Math.round(s.price*100),0),client=b.name.trim();
const old=await env.DB.prepare('SELECT id,date,start,client,services,active FROM schedule_entries WHERE id=?').bind(b.requestId).first();
if(old){if(old.active&&old.date===b.date&&old.start===start&&old.client===client&&old.services===serviceData)return json({id:old.id,status:'pending'});return json({error:'Atualize a página para fazer um novo pedido.'},409);}
const result=await env.DB.prepare("INSERT INTO schedule_entries (id,date,start,end,kind,note,client,active,created_at,status,services,total) SELECT ?,?,?,?,'appointment','',?,1,?,'pending',?,? WHERE NOT EXISTS (SELECT 1 FROM schedule_entries WHERE date=? AND active=1 AND start < ? AND end > ?)").bind(b.requestId,b.date,start,end,client,stamp(),serviceData,total,b.date,end,start).run();
if(!result.meta.changes)return json({error:'Esse horário acabou de ser ocupado. Escolha outro.'},409);
return json({id:b.requestId,status:'pending'},201);
}
if(!await authorized(request,env))return json({error:'Acesso exclusivo da administradora. Entre com a conta autorizada.'},403);
if(request.method!=='GET'){
const origin=request.headers.get('origin');if(origin!==url.origin)return json({error:'Origem inválida.'},403);
if(!(request.headers.get('content-type')||'').includes('application/json'))return json({error:'Formato inválido.'},415);
}
if(p==='/api/admin/me'&&request.method==='GET'){const setting=await env.DB.prepare("SELECT value FROM settings WHERE key='admin_email'").first();return json({email:request.headers.get('oai-authenticated-user-email'),configured:!!setting});}
if(p==='/api/admin/entries'&&request.method==='GET'){const rows=await env.DB.prepare('SELECT * FROM schedule_entries ORDER BY date DESC, start, created_at').all();return json({entries:rows.results});}
if(p==='/api/admin/entries'&&request.method==='POST'){
const b=await body(request);if(!validDate(b.date||'')||b.date<localNow().date||!Number.isInteger(b.start)||!Number.isInteger(b.end)||b.start<OPEN||b.end>CLOSE||b.start>=b.end||!['block','appointment'].includes(b.kind)||typeof b.note!=='string'||b.note.length>120||typeof b.client!=='string'||b.client.length>80)return json({error:'Confira a data e o intervalo entre 9h e 17h.'},400);
if(b.kind==='appointment'&&(!validOpenDay(b.date)||!b.client.trim()))return json({error:'Informe o nome da cliente e um dia de atendimento (quarta a sábado).'},400);
const id=crypto.randomUUID();
if(b.kind==='appointment'){
const result=await env.DB.prepare('INSERT INTO schedule_entries (id,date,start,end,kind,note,client,active,created_at) SELECT ?,?,?,?,?,?,?,1,? WHERE NOT EXISTS (SELECT 1 FROM schedule_entries WHERE date = ? AND active=1 AND start < ? AND end > ?)').bind(id,b.date,b.start,b.end,b.kind,b.note,b.client,stamp(),b.date,b.end,b.start).run();if(!result.meta.changes)return json({error:'Esse intervalo já está ocupado ou bloqueado.'},409);
}else await env.DB.prepare('INSERT INTO schedule_entries (id,date,start,end,kind,note,client,active,created_at) VALUES (?,?,?,?,?,?,?,1,?)').bind(id,b.date,b.start,b.end,b.kind,b.note,b.client,stamp()).run();
return json({id},201);}
if(p.startsWith('/api/admin/entries/')&&request.method==='PATCH'){
const id=p.split('/').at(-1),b=await body(request);if(!['remove','restore','confirm'].includes(b.action))return json({error:'Ação inválida.'},400);const row=await env.DB.prepare('SELECT * FROM schedule_entries WHERE id=?').bind(id).first();if(!row)return json({error:'Registro não encontrado.'},404);
if(b.action==='confirm'){if(!row.active||row.kind!=='appointment')return json({error:'Esse pedido está cancelado ou não é um atendimento.'},409);await env.DB.prepare("UPDATE schedule_entries SET status='confirmed' WHERE id=?").bind(id).run();return json({ok:true});}
if(b.action==='restore'&&row.kind==='appointment'){const result=await env.DB.prepare('UPDATE schedule_entries SET active=1 WHERE id=? AND NOT EXISTS (SELECT 1 FROM schedule_entries WHERE active=1 AND id <> ? AND date=? AND start < ? AND end > ?)').bind(id,id,row.date,row.end,row.start).run();if(!result.meta.changes)return json({error:'Não foi possível restaurar: o intervalo está ocupado.'},409);}else await env.DB.prepare('UPDATE schedule_entries SET active=? WHERE id=?').bind(b.action==='restore'?1:0,id).run();return json({ok:true});}
if(p==='/api/admin/access'&&request.method==='PUT'){
const b=await body(request);const email=String(b.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||b.confirm!==email)return json({error:'Confira e confirme o e-mail da conta da Juh.'},400);
await env.DB.prepare("INSERT INTO settings (key,value) VALUES ('admin_email',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(email).run();return json({ok:true,transferred:email!==(request.headers.get('oai-authenticated-user-email')||'').toLowerCase()});}
return json({error:'Não encontrado.'},404);
}
let file=p==='/'?'/index.html':p==='/admin'||p==='/admin/'?'/admin.html':p;
if(file==='/admin.html'){
if(!request.headers.get('oai-authenticated-user-id'))return Response.redirect(url.origin+'/signin-with-chatgpt?return_to=%2Fadmin',302);
if(!env.DB||!await authorized(request,env))file='/denied.html';
}
if(!(file in ASSETS))return new Response('Página não encontrada',{status:404});
const ext=file.split('.').at(-1),type=({html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'application/javascript; charset=utf-8',jpeg:'image/jpeg',png:'image/png'})[ext]||'application/octet-stream';const bytes=Uint8Array.from(atob(ASSETS[file]),c=>c.charCodeAt(0));return new Response(bytes,{status:file==='/denied.html'?403:200,headers:{'Content-Type':type,'Cache-Control':ext==='html'||ext==='js'?'no-store':'public, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'"}});
}catch(error){console.error('Agenda request failed',error?.message);return json({error:'Não foi possível concluir. Tente novamente.'},500);}}};
export {slots,validDate,validOpenDay,authorized};
