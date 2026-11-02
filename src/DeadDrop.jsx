import {useEffect,useState} from 'react'
import {sb,useGeo,useNow,fmt,compass,km,share,useHeading,askHeading,facing} from './lib'
import {Btn,Screen,Stamp,Err,Card,GpsBar,Title,Hz,Attrib} from './ui'
import {Back,Timer,Walk,X,Box,Check} from './icons'
import OpsMap from './OpsMap'
import {getPick,setPick,fd,arrow} from './Radar'
// fallback when the radar list is empty: try close, then widen
const BANDS=[[150,800],[800,1500],[1500,3000]]
const SECURE_M=30

/* compass dial: N up, red needle points to the drop (relative to heading when the phone has a compass) */
const Dial=({rot,on})=><svg viewBox="0 0 64 64" className="size-20 shrink-0" aria-hidden="true">
 <circle cx="32" cy="32" r="27" fill="none" stroke="#2C3631" strokeWidth="2"/>
 {Array.from({length:24},(_,i)=>{const a=i*15*Math.PI/180,l=i%6===0?5:2.5;return <line key={i} x1={32+27*Math.sin(a)} y1={32-27*Math.cos(a)} x2={32+(27-l)*Math.sin(a)} y2={32-(27-l)*Math.cos(a)} stroke="#9AA69F" strokeWidth="1"/>})}
 <g fontFamily="Barlow Condensed,sans-serif" fontWeight="700" fontSize="8" textAnchor="middle"><text x="32" y="15" fill="#E5584F">N</text><text x="32" y="56" fill="#E7ECE8">S</text><text x="52" y="35" fill="#E7ECE8">E</text><text x="12" y="35" fill="#E7ECE8">W</text></g>
 {on&&<g transform={`rotate(${rot} 32 32)`}><path d="M32 16l4.5 16h-9z" fill="#E5584F"/><path d="M32 48l4.5-16h-9z" fill="#E7ECE8"/></g>}
 <circle cx="32" cy="32" r="2.5" fill="#0C110F" stroke="#E7ECE8" strokeWidth="1"/></svg>

export default function DeadDrop({agent,onExit}){
 const[pos,gpsErr,posRef]=useGeo(),now=useNow(),heading=useHeading()
 const[run,setRun]=useState(()=>JSON.parse(localStorage.getItem('sh_run')||'null'))
 const[phase,setPhase]=useState(run?'run':'setup'),[st,setSt]=useState(),[res,setRes]=useState(),[msg,setMsg]=useState(),[busy,setBusy]=useState(false)
 const[drops,setDrops]=useState(),[pick,setPk]=useState(getPick)
 const save=r=>{r?localStorage.setItem('sh_run',JSON.stringify(r)):localStorage.removeItem('sh_run');setRun(r)}
 const end=r=>{save(null);setRes(r);setPhase('done')}
 const ready=!!pos&&pos.acc<=150

 // nearby drops for the picker (one scan when GPS is good)
 useEffect(()=>{if(phase!=='setup'||!ready||drops)return
  sb.rpc('radar_scan',{p_lat:pos.lat,p_lng:pos.lng}).then(({data})=>{const d=data?.drops||[];setDrops(d);if(!d.some(x=>x.id===pick))setPk(d[0]?.id||null)})},[phase,ready])

 useEffect(()=>{if(phase!=='run'||!run)return;let live=true
  const f=async()=>{const p=posRef.current;if(!p)return
   const{data,error}=await sb.rpc('drop_ping',{p_run:run.run_id,p_lat:p.lat,p_lng:p.lng});if(!live||error||!data)return
   if(data.status==='missing'||data.status==='abandoned')return end({ok:false,reason:'This op was closed.'})
   if(data.status==='failed')return end({ok:false,reason:'Time ran out. The drop went dark.'})
   setSt(data)}
  f();const i=setInterval(f,5000);return()=>{live=false;clearInterval(i)}},[phase,run?.run_id,!!pos])

 const start=async()=>{const p=posRef.current;if(!p)return;setBusy(true);setMsg()
  if(pick){const{data,error}=await sb.rpc('start_drop_pick',{p_lat:p.lat,p_lng:p.lng,p_drop:pick});setBusy(false)
   if(error){setDrops();return setMsg(error.message)}
   setPick(null);save(data);return setPhase('brief')}
  for(const[min,max]of BANDS){const{data,error}=await sb.rpc('start_drop',{p_lat:p.lat,p_lng:p.lng,p_min:min,p_max:max})
   if(error){setBusy(false);return setMsg(error.message)}
   if(data){setBusy(false);save(data);return setPhase('brief')}}
  setBusy(false);setMsg('No drops within 3 km of you right now. Check the radar on HQ, or try again from another area.')}
 const secure=async()=>{setBusy(true);setMsg();const{data,error}=await sb.rpc('complete_drop',{p_run:run.run_id});setBusy(false)
  if(error)return setMsg(error.message);if(!data.ok)return setMsg(data.reason);end({...data,codename:run.codename})}
 const abort=async()=>{if(!confirm('Abort this op? You get no XP for it.'))return;await sb.rpc('abort_drop',{p_run:run.run_id});save(null);onExit()}

 if(phase==='setup')return <Screen title="Dead Drop" kicker="Solo op · 10–40 min" onBack={onExit}>
  <p className="text-lg">Intel is hidden at a real spot near you. Pick a drop, walk there and grab it before time runs out.</p>
  <Card className="p-4">
   <div className="flex items-center justify-between mb-3"><h2 className="stencil text-2xl flex items-center">Nearby drops<Hz/></h2><GpsBar pos={pos} detail={false}/></div>
   {!ready?<p className="text-mute">{gpsErr||'Waiting for a good GPS fix…'}</p>:!drops?<p className="text-mute">Scanning…</p>:!drops.length?<p className="text-mute">No drops within 3 km right now.</p>:
   <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Choose a drop">{drops.map((d,i)=><li key={d.id}>
    <button role="radio" aria-checked={d.id===pick} onClick={()=>setPk(d.id)} className={'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left '+(d.id===pick?'border-amber bg-amber/10':'border-line hover:bg-raise')}>
     <Box className={'size-6 shrink-0 '+(d.id===pick?'text-amber':'text-mute')}/>
     <span className="flex-1 min-w-0"><span className="wide text-xl">{fd(d.dist)} {compass(d.brg)} <span aria-hidden="true">{arrow(d.brg)}</span></span>
      <span className="block text-sm text-mute">{i===0?'Nearest · ':''}about {Math.max(10,Math.round(d.dist/1.2/60*1.6+3))} min on the clock</span></span>
     {d.id===pick&&<Check className="size-6 text-amber"/>}</button></li>)}</ul>}
  </Card>
  <ol className="flex flex-col gap-2 text-mute">{[
   'The map shows a dashed circle where it\'s hidden. The arrow and distance lead you to the exact spot.',
   'Within 200 m you get a clue about the spot.',
   'Within 30 m, tap Secure intel. Faster means more XP.'].map((t,i)=><li key={i} className="flex gap-3"><span className="wide text-signal w-4 shrink-0">{i+1}</span>{t}</li>)}</ol>
  <div className="mt-auto flex flex-col gap-2">
   {gpsErr&&!pos&&<Err>{gpsErr}</Err>}<Err>{msg}</Err>
   <Btn disabled={!pos||pos.acc>150||busy} onClick={start}><Box className="size-6"/>{busy?'Starting…':!pos?'Getting your location…':pos.acc>150?'Waiting for better GPS…':pick?'Run to this drop':'Find a drop'}</Btn></div></Screen>

 if(phase==='brief')return <div className="min-h-dvh flex flex-col p-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
  <div className="text-mute">Briefing for {agent.callsign}</div>
  <h1 className="stencil text-6xl mt-1">Operation<br/><span className="text-signal">{run.codename}</span><Hz/></h1>
  <ul className="mt-8 space-y-4 text-xl leading-snug flex-1">
   <li>Intel is hidden about <b>{km(run.distance)} km</b> from you, inside the marked zone.</li>
   <li>You have <b>{fmt((new Date(run.deadline)-now)/1000)}</b>. Clock is already running.</li>
   <li>A hint unlocks within 200 m. Tap <b>Secure intel</b> within 30 m.</li>
   <li>Hold your phone flat and follow the arrow. You can abort any time.</li></ul>
  <Btn onClick={()=>{askHeading();setPhase('run')}}>Move out</Btn></div>

 if(phase==='done')return <Screen title={res.ok?'Intel secured':'Op failed'} kicker={res.codename?`Operation ${res.codename}`:'Dead Drop'}>
  <div className="py-6 text-center"><Stamp c={res.ok?'ok':'alert'}>{res.ok?'Secured':'Lost'}</Stamp></div>
  {res.ok?<Card className="p-4 grid grid-cols-3 text-center">{[['+'+res.xp,'XP'],[km(res.meters),'km'],[fmt(res.seconds),'time']].map(([v,l])=><div key={l}><div className="wide text-3xl">{v}</div><div className="text-mute">{l}</div></div>)}</Card>
   :<p className="text-lg text-center">{res.reason}</p>}
  <div className="mt-auto flex flex-col gap-3">
   {res.ok&&<Btn v="ghost" onClick={()=>share(`Secured Operation ${res.codename} on Safehouse: ${km(res.meters)} km on foot in ${fmt(res.seconds)}.`)}>Share result</Btn>}
   <Btn onClick={()=>{setRes();setDrops();setPhase('setup')}}>New drop</Btn><Btn v="ghost" onClick={onExit}>Back to HQ</Btn></div></Screen>

 const left=(new Date(run.deadline)-now)/1000,d=st?.distance,near=d!=null&&d<=SECURE_M,face=facing(heading,pos),rot=st?(face==null?st.bearing:st.bearing-face):0
 return <div className="h-dvh flex flex-col">
  <header className="px-4 pt-[max(.9rem,env(safe-area-inset-top))] pb-3 flex items-end gap-3">
   <button onClick={onExit} aria-label="Back to HQ" className="size-10 -ml-1 grid place-items-center rounded-full hover:bg-raise"><Back/></button>
   <div className="min-w-0 flex-1"><div className="text-mute">Operation</div><Title wrap className="text-[1.75rem]">{run.codename}</Title></div>
   <div className={`rounded-xl border px-3 py-1.5 inline-flex items-center gap-2 wide text-3xl tabular-nums ${left<120?'border-alert text-alert':'border-alert/70 text-ink'}`}><Timer className="size-6 text-alert"/>{fmt(left)}</div></header>
  <div className="relative flex-1 mx-3 rounded-2xl overflow-hidden border border-line">
   <OpsMap center={{lat:run.zone_lat,lng:run.zone_lng}} zoom={run.zone_r>250?15:16} me={pos} ctl="right-3 top-3" heading={face} rotatable
    circles={[{lat:run.zone_lat,lng:run.zone_lng,r:run.zone_r,dash:true,color:'#E5584F'}]}/></div>
  <div className="px-3 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] space-y-3">
   {gpsErr&&<Err>{gpsErr}</Err>}<Err>{msg}</Err>
   <Card className="p-4 flex items-center gap-4">
    <Dial rot={rot} on={!!st}/>
    <div className="min-w-0 flex-1"><div className="text-mute">{face==null?'Arrow points on the map (north is up)':'Turn until the arrow points up, then walk'}</div>
     <div className="wide text-5xl leading-none mt-1 tabular-nums">{d==null?'—':d>=1000?km(d)+' km':d+' m'} <span>{st?compass(st.bearing):''}</span></div>
     {st?.hint&&<div className="font-semibold mt-1.5"><span className="text-amber">Hint:</span> {st.hint}</div>}</div>
    <span className="self-end"><Hz/></span></Card>
   {near?<Btn disabled={busy} onClick={secure}><Check className="size-6"/>Secure intel</Btn>
    :<div role="status" className="w-full rounded-xl py-3.5 px-5 text-xl wide inline-flex items-center justify-center gap-2.5 bg-signal/10 text-ink border border-signal/60"><Walk className="size-6 text-amber"/>{d==null?'Locking signal…':`Walk ${Math.max(0,d-SECURE_M)} m more to secure`}</div>}
   <div className="flex items-center gap-3">
    <GpsBar pos={pos} detail={false}/>
    <button onClick={abort} className="rounded-lg border border-alert/70 text-alert px-3 py-1 wide text-base whitespace-nowrap inline-flex items-center gap-1.5"><X className="size-4"/>Abort op</button>
    <Attrib className="ml-auto"/></div></div></div>
}
