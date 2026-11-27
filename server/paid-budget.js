import {createHash,randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdirSync} from 'node:fs';

export const isJobKey=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const digest=v=>createHash('sha256').update(v).digest('hex');
const production=()=>!!process.env.VERCEL||process.env.NODE_ENV==='production';
const rpcReady=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(process.env.SUPABASE_URL||'')&&!!process.env.SUPABASE_SERVICE_ROLE_KEY;
export function dailyLimit(kind){
  const n=Number(process.env[kind==='fashn'?'BELLO_FASHN_DAILY_CREDITS':'BELLO_OPENAI_DAILY_REQUESTS']);
  return Number.isInteger(n)&&n>0&&n<=10000?n:0;
}
export function budgetConfigured(kind){return dailyLimit(kind)>0&&(!production()||rpcReady());}
let store;
async function localDb(){
  if(!store)store=(async()=>{
    const {DatabaseSync}=await import('node:sqlite');
    const dir=join(tmpdir(),'bello-budget-'+digest(process.cwd()).slice(0,16));
    mkdirSync(dir,{recursive:true,mode:0o700});
    const db=new DatabaseSync(join(dir,'ledger.sqlite'));
    db.exec('PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS reservation (kind TEXT, job TEXT, fingerprint TEXT, day TEXT, units INTEGER, reference TEXT, PRIMARY KEY(kind,job))');
    return db;
  })().catch(e=>{store=undefined;throw e;});
  return store;
}
async function rpc(name,body){
  if(!rpcReady())throw Error('서버 예산 저장소 설정이 필요해요.');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw Error('예산을 확인할 수 없어 요청을 중단했어요.');
  return r.status===204?null:r.json();
}
// Reserve before contacting a paid provider. Unknown upstream outcomes remain charged against the ceiling.
export async function reservePaid(kind,key,payload,units=1){
  const limit=dailyLimit(kind);
  if(!budgetConfigured(kind)||!limit||!isJobKey(key))return {state:'disabled'};
  const fingerprint=digest(JSON.stringify(payload));
  if(production())return rpc('bello_reserve',{p_kind:kind,p_job:key,p_fingerprint:fingerprint,p_units:units,p_limit:limit});
  const db=await localDb(),day=new Date().toISOString().slice(0,10);
  db.exec('BEGIN IMMEDIATE');
  try {
    const prior=db.prepare('SELECT fingerprint,reference FROM reservation WHERE kind=? AND job=?').get(kind,key);
    let result;
    if(prior)result={state:prior.fingerprint===fingerprint?'existing':'conflict',reference:prior.fingerprint===fingerprint?prior.reference:null};
    else{
      const {used}=db.prepare('SELECT coalesce(sum(units),0) AS used FROM reservation WHERE kind=? AND day=?').get(kind,day);
      if(used+units>limit)result={state:'limit'};
      else{db.prepare('INSERT INTO reservation VALUES (?,?,?,?,?,NULL)').run(kind,key,fingerprint,day,units);result={state:'reserved'};}
    }
    db.exec('COMMIT');return result;
  }catch(e){db.exec('ROLLBACK');throw e;}
}
export async function recordJob(kind,key,reference){
  if(production())return rpc('bello_record_job',{p_kind:kind,p_job:key,p_reference:reference});
  const db=await localDb();db.prepare('UPDATE reservation SET reference=? WHERE kind=? AND job=? AND reference IS NULL').run(reference,kind,key);
}
export function freshKey(){return randomUUID();}

