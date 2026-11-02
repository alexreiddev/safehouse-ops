import {useCallback,useEffect,useState} from 'react'
import {rpc,here} from './api'

const toLocal=iso=>{if(!iso)return'';const d=new Date(iso),p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
const inp='w-full rounded-2xl border border-line bg-card px-3 py-2 font-semibold'

function Row({f,reload}){
 const[d,setD]=useState({lat:f.lat??'',lng:f.lng??'',radius:f.radius,release_at:toLocal(f.release_at),collective_min:f.collective_min})
 const[msg,setMsg]=useState(),[busy,setBusy]=useState(false)
 const set=k=>e=>setD({...d,[k]:e.target.value})
 const save=async patch=>{setBusy(true);setMsg()
  try{await rpc('story_admin_set',{p_file:f.id,p:patch});setMsg('Saved.');await reload()}catch(x){setMsg(x.message)}setBusy(false)}
 const saveAll=()=>save({lat:String(d.lat),lng:String(d.lng),radius:Number(d.radius)||30,
  release_at:d.release_at?new Date(d.release_at).toISOString():'',collective_min:Number(d.collective_min)||0})
 const mine=async()=>{setMsg('Getting your location…');try{const p=await here();setD({...d,lat:p.lat.toFixed(6),lng:p.lng.toFixed(6)});setMsg('Location captured. Tap Save.')}catch(x){setMsg(x.message)}}
 const placed=f.lat!=null
 return <section className="rounded-2xl border border-line bg-card p-4 flex flex-col gap-3">
  <div className="flex justify-between gap-2"><div><span className="font-extrabold">{f.id}</span> <span className="font-extrabold text-lg">{f.title}</span>
   <div className="text-sm text-mute font-semibold">{f.place}</div></div>
   <div className="text-right text-sm font-bold shrink-0">{f.secured} secured<br/>{f.unlocked} unlocked</div></div>
  <div className="flex gap-2 flex-wrap text-sm font-bold">
   <span className={`rounded px-2 py-1 border ${f.active?'bg-signal text-onsig border-signal':'border-line text-mute'}`}>{f.active?'Live':'Inactive'}</span>
   {f.frozen&&<span className="rounded px-2 py-1 bg-alert text-white">Frozen</span>}
   {f.squad_only&&<span className="rounded px-2 py-1 border border-line">Squad</span>}
   {!placed&&<span className="rounded px-2 py-1 border border-alert/70 text-alert">Not placed</span>}</div>
  <button onClick={mine} className="rounded-2xl border border-line py-3 font-extrabold">Use where I'm standing</button>
  <div className="grid grid-cols-2 gap-2">
   <label className="text-sm font-bold">Lat<input className={inp} inputMode="decimal" value={d.lat} onChange={set('lat')}/></label>
   <label className="text-sm font-bold">Lng<input className={inp} inputMode="decimal" value={d.lng} onChange={set('lng')}/></label>
   <label className="text-sm font-bold">Radius (m)<input className={inp} inputMode="numeric" value={d.radius} onChange={set('radius')}/></label>
   <label className="text-sm font-bold">Collective unlock<input className={inp} inputMode="numeric" value={d.collective_min} onChange={set('collective_min')}/></label>
  </div>
  <label className="text-sm font-bold">Release at (blank = right away)<input type="datetime-local" className={inp} value={d.release_at} onChange={set('release_at')}/></label>
  <div className="grid grid-cols-3 gap-2">
   <button disabled={busy} onClick={saveAll} className="rounded-xl bg-signal text-onsig border border-signal py-3 font-extrabold">Save</button>
   <button disabled={busy||(!placed&&!f.active)} onClick={()=>save({active:!f.active})} className="rounded-2xl border border-line py-3 font-extrabold">{f.active?'Deactivate':'Activate'}</button>
   <button disabled={busy} onClick={()=>save({frozen:!f.frozen})} className={`rounded-xl border-2 py-3 font-extrabold ${f.frozen?'border-line':'border-alert text-alert'}`}>{f.frozen?'Unfreeze':'Freeze'}</button>
  </div>
  {msg&&<p className="text-sm font-bold">{msg}</p>}
 </section>}

export default function StoryAdmin({onBack,Shell}){
 const[rows,setRows]=useState(),[e,setE]=useState()
 const load=useCallback(()=>rpc('story_admin_list').then(r=>{setRows(r);setE()}).catch(x=>setE(x.message)),[])
 useEffect(()=>{load()},[load])
 const all=async v=>{if(!confirm(v?'Freeze every drop now?':'Unfreeze every drop?'))return;try{await rpc('story_admin_freeze_all',{p_frozen:v});load()}catch(x){setE(x.message)}}
 return <Shell kicker="HQ" title="Story drops" onBack={onBack}>
  <p className="font-semibold">Stand on each spot, tap "Use where I'm standing", save, then activate. A drop stays inactive until you've checked it on the ground.</p>
  <div className="grid grid-cols-2 gap-2">
   <button onClick={()=>all(true)} className="rounded-xl bg-alert text-white border border-line py-3 font-extrabold">Freeze all</button>
   <button onClick={()=>all(false)} className="rounded-2xl border border-line py-3 font-extrabold">Unfreeze all</button></div>
  {e&&<p className="font-bold text-alert">{e}</p>}
  {!rows?<p className="text-mute font-semibold">Loading…</p>:rows.map(f=><Row key={f.id} f={f} reload={load}/>)}
 </Shell>}
