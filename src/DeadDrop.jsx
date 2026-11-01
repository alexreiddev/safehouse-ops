import {useEffect,useState} from 'react'
import {sb,useGeo,useNow,fmt,compass,km,share,useHeading,askHeading} from './lib'
import {Btn,Screen,Stamp,Err,Card,GpsBar} from './ui'
import OpsMap from './OpsMap'
// nearest first: try close, then widen
const BANDS=[[150,800],[800,1500],[1500,3000]]
const SECURE_M=30

export default function DeadDrop({agent,onExit}){
 const[pos,gpsErr,posRef]=useGeo(),now=useNow(),heading=useHeading()
 const[run,setRun]=useState(()=>JSON.parse(localStorage.getItem('sh_run')||'null'))
 const[phase,setPhase]=useState(run?'run':'setup'),[st,setSt]=useState(),[res,setRes]=useState(),[msg,setMsg]=useState(),[busy,setBusy]=useState(false)
 const save=r=>{r?localStorage.setItem('sh_run',JSON.stringify(r)):localStorage.removeItem('sh_run');setRun(r)}
 const end=r=>{save(null);setRes(r);setPhase('done')}

 useEffect(()=>{if(phase!=='run'||!run)return;let live=true
  const f=async()=>{const p=posRef.current;if(!p)return
   const{data,error}=await sb.rpc('drop_ping',{p_run:run.run_id,p_lat:p.lat,p_lng:p.lng});if(!live||error||!data)return
   if(data.status==='missing'||data.status==='abandoned')return end({ok:false,reason:'This op was closed.'})
   if(data.status==='failed')return end({ok:false,reason:'Time ran out. The drop went dark.'})
   setSt(data)}
  f();const i=setInterval(f,5000);return()=>{live=false;clearInterval(i)}},[phase,run?.run_id,!!pos])

 const start=async()=>{const p=posRef.current;if(!p)return;setBusy(true);setMsg()
  for(const[min,max]of BANDS){const{data,error}=await sb.rpc('start_drop',{p_lat:p.lat,p_lng:p.lng,p_min:min,p_max:max})
   if(error){setBusy(false);return setMsg(error.message)}
   if(data){setBusy(false);save(data);return setPhase('brief')}}
  setBusy(false);setMsg('No drops within 3 km of you right now. Check the radar on HQ, or try again from another area.')}
 const secure=async()=>{setBusy(true);setMsg();const{data,error}=await sb.rpc('complete_drop',{p_run:run.run_id});setBusy(false)
  if(error)return setMsg(error.message);if(!data.ok)return setMsg(data.reason);end({...data,codename:run.codename})}
 const abort=async()=>{if(!confirm('Abort this op? You get no XP for it.'))return;await sb.rpc('abort_drop',{p_run:run.run_id});save(null);onExit()}

 if(phase==='setup')return <Screen title="Dead Drop" kicker="Solo op · 10–40 min" onBack={onExit}>
  <p className="text-lg font-semibold">Intel is hidden at a real spot near you. Walk there and grab it before time runs out.</p>
  <ol className="flex flex-col gap-3">{[
   ['Tap Find a drop','HQ picks the nearest hidden intel, up to 3 km away.'],
   ['Follow the arrow','The map shows a dashed circle where it\'s hidden. The arrow and distance at the bottom lead you to the exact spot.'],
   ['Read the hint','Within 200 m you get a clue about the spot.'],
   ['Secure it','Within 30 m, tap Secure intel. Faster means more XP.']].map(([t,d],i)=>
   <li key={t} className="flex gap-3"><span className="stencil text-3xl size-10 shrink-0 rounded bg-ink text-signal grid place-items-center">{i+1}</span><div><div className="font-extrabold text-lg leading-tight">{t}</div><div className="text-mute">{d}</div></div></li>)}</ol>
  <div className="mt-auto flex flex-col gap-2">
   {gpsErr&&!pos&&<Err>{gpsErr}</Err>}<GpsBar pos={pos}/>
   <Err>{msg}</Err>
   <Btn disabled={!pos||pos.acc>150||busy} onClick={start}>{busy?'Searching…':!pos?'Getting your location…':pos.acc>150?'Waiting for better GPS…':'Find a drop'}</Btn></div></Screen>

 if(phase==='brief')return <div className="min-h-dvh bg-ink text-paper flex flex-col p-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
  <div className="text-paper/70 font-semibold">Briefing for {agent.callsign}</div>
  <h1 className="stencil text-7xl text-signal mt-1">Operation<br/>{run.codename}</h1>
  <ul className="mt-8 space-y-4 text-xl leading-snug flex-1">
   <li>Intel is hidden about <b>{km(run.distance)} km</b> from you, inside the marked zone.</li>
   <li>You have <b>{fmt((new Date(run.deadline)-now)/1000)}</b>. Clock is already running.</li>
   <li>A hint unlocks within 200 m. Tap <b>Secure intel</b> within 30 m.</li>
   <li>Hold your phone flat and follow the arrow. You can abort any time.</li></ul>
  <Btn onClick={()=>{askHeading();setPhase('run')}}>Move out</Btn></div>

 if(phase==='done')return <Screen title={res.ok?'Intel secured':'Op failed'} kicker={res.codename?`Operation ${res.codename}`:'Dead Drop'}>
  <div className="py-6 text-center"><Stamp c={res.ok?'ok':'alert'}>{res.ok?'Secured':'Lost'}</Stamp></div>
  {res.ok?<Card className="p-4 grid grid-cols-3 text-center">{[['+'+res.xp,'XP'],[km(res.meters),'km'],[fmt(res.seconds),'time']].map(([v,l])=><div key={l}><div className="wide text-3xl font-black">{v}</div><div className="text-mute">{l}</div></div>)}</Card>
   :<p className="text-lg text-center">{res.reason}</p>}
  <div className="mt-auto flex flex-col gap-3">
   {res.ok&&<Btn v="ghost" onClick={()=>share(`Secured Operation ${res.codename} on Safehouse: ${km(res.meters)} km on foot in ${fmt(res.seconds)}.`)}>Share result</Btn>}
   <Btn onClick={()=>{setRes();setPhase('setup')}}>New drop</Btn><Btn v="ghost" onClick={onExit}>Back to HQ</Btn></div></Screen>

 const left=(new Date(run.deadline)-now)/1000,d=st?.distance,near=d!=null&&d<=SECURE_M,rot=st?(heading==null?st.bearing:st.bearing-heading):0
 return <div className="h-dvh relative overflow-hidden">
  <OpsMap center={{lat:run.zone_lat,lng:run.zone_lng}} zoom={run.zone_r>250?15:16} me={pos} circles={[{lat:run.zone_lat,lng:run.zone_lng,r:run.zone_r,dash:true}]}/>
  <div className="absolute top-0 inset-x-0 z-[1000] bg-ink text-paper px-4 pt-[max(.75rem,env(safe-area-inset-top))] pb-3 flex items-end justify-between gap-3">
   <div className="min-w-0"><div className="text-sm text-paper/70 font-semibold">Operation</div><div className="stencil text-3xl truncate">{run.codename}</div></div>
   <div className={`wide text-3xl font-black tabular-nums ${left<120?'text-alert bg-paper px-2 rounded':'text-signal'}`}>{fmt(left)}</div></div>
  <div className="absolute bottom-0 inset-x-0 z-[1000] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] space-y-2">
   <GpsBar pos={pos}/>{gpsErr&&<Err>{gpsErr}</Err>}<Err>{msg}</Err>
   <Card className="p-4 flex items-center gap-4">
    <svg viewBox="0 0 40 40" className="size-16 shrink-0" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="2.5"/>
     {st&&<path d="M20 5 L27 27 L20 22 L13 27 Z" fill="#13201A" transform={`rotate(${rot} 20 20)`}/>}</svg>
    <div className="min-w-0"><div className="text-mute font-semibold text-sm">{heading==null?'Arrow points on the map (north is up)':'Turn until the arrow points up, then walk'}</div>
     <div className="wide text-4xl font-black tabular-nums">{d==null?'—':d>=1000?km(d)+' km':d+' m'} <span className="text-2xl">{st?compass(st.bearing):''}</span></div>
     {st?.hint&&<div className="font-semibold mt-1">Hint: {st.hint}</div>}</div></Card>
   <Btn disabled={!near||busy} onClick={secure}>{near?'Secure intel':d==null?'Locking signal…':`Walk ${Math.max(0,d-SECURE_M)} m more to secure`}</Btn>
   <button onClick={abort} className="w-full text-center font-bold text-alert py-1">Abort op</button></div></div>
}
