import {useEffect,useRef,useState} from 'react'
import {sb,useGeo,useNow,dist,fmt,code4,km,share,compass} from './lib'
import {Btn,Screen,Pick,Field,inputCls,Err,Stamp,Card,GpsBar} from './ui'
import Guide,{HUNT,seen,mark} from './Tour'
import OpsMap from './OpsMap'
import Scope from './Scope'
// Supabase queries are lazy: they only run when awaited or .then() is called
const fire=q=>q.then(({error})=>{if(error)console.warn(error.message)})
const leave=async(lid,host,running,exit)=>{
 if(!confirm(host?(running?'End this op for everyone?':'Close this squad for everyone?'):(running?'Leave this op? You get no XP for it.':'Leave this squad?')))return
 await sb.rpc('leave_hunt',{p_lobby:lid});exit()}

export default function Hunt({agent,onExit}){
 const[s,setS]=useState(()=>JSON.parse(localStorage.getItem('sh_hunt')||'{"v":"menu"}'))
 const go=x=>{x.v==='menu'?localStorage.removeItem('sh_hunt'):localStorage.setItem('sh_hunt',JSON.stringify(x));setS(x)}
 const exit=()=>{localStorage.removeItem('sh_hunt');onExit()}
 const[help,setHelp]=useState(()=>!seen('sh_hunt_guide'))
 if(s.v==='create')return <Create agent={agent} go={go}/>
 if(s.v==='join')return <Join agent={agent} go={go}/>
 if(s.v==='lobby')return <Lobby s={s} go={go} exit={exit}/>
 return <Screen title="ShadowHunt" kicker="Squad op · 2–10 agents" onBack={onExit}>
  {help&&<Guide slides={HUNT} label="Let's go" onDone={()=>{mark('sh_hunt_guide');setHelp(false)}}/>}
  <p className="text-lg">Shadows hide inside a circle. Hunters only see them as pings every few minutes. The circle shrinks every 10 minutes. Get close and tag them. Tagged shadows join the hunters.</p>
  <ol className="list-decimal pl-5 space-y-1.5 text-lg"><li><b>Create a squad</b> and send the 4-letter code to friends.</li><li>The host sets roles, then taps <b>Start op</b>.</li><li>Shadows hide. Then the hunt begins.</li></ol>
  <button onClick={()=>setHelp(true)} className="underline font-bold text-mute text-left">Read the full rules</button>
  <div className="mt-auto flex flex-col gap-3"><Btn onClick={()=>go({v:'create'})}>Create squad</Btn><Btn v="ghost" onClick={()=>go({v:'join'})}>Join with code</Btn></div></Screen>
}

function Create({agent,go}){
 const[pos,gpsErr]=useGeo(),[ctr,setCtr]=useState(),[err,setErr]=useState(),[busy,setBusy]=useState(false)
 const[c,setC]=useState({radius:400,duration:20,ping_interval:3,catch_radius:20,hide_time:2,hunters:1})
 const set=k=>v=>setC(o=>({...o,[k]:v}))
 useEffect(()=>{if(!ctr&&pos&&pos.acc<=100)setCtr({lat:pos.lat,lng:pos.lng})},[pos,ctr])
 const make=async()=>{setBusy(true);setErr();try{
  let l,e;for(let k=0;k<4;k++){({data:l,error:e}=await sb.from('lobbies').insert({code:code4(),host_id:agent.id,config:{zone_lat:ctr.lat,zone_lng:ctr.lng,...c}}).select().single());if(!e||e.code!=='23505')break}
  if(e)throw e
  const{data:p,error:e2}=await sb.from('players').insert({lobby_id:l.id,user_id:agent.id,is_host:true,role:'hunter'}).select().single();if(e2)throw e2
  go({v:'lobby',lid:l.id,me:p.id})}catch(e){setErr(e.message);setBusy(false)}}
 return <Screen title="New squad" kicker="ShadowHunt" onBack={()=>go({v:'menu'})}>
  <div className="relative h-56 -mx-4 -mt-4 border-b-2 border-ink">{ctr?<OpsMap center={ctr} zoom={15} me={pos} circles={[{...ctr,r:c.radius,color:'#2563eb'}]} onPick={(lat,lng)=>setCtr({lat,lng})}/>:<div className="p-4"><p className="text-mute font-semibold mb-2">Waiting for a precise GPS fix…</p>{pos&&<Btn v="ghost" onClick={()=>setCtr({lat:pos.lat,lng:pos.lng})}>Use rough position anyway</Btn>}</div>}</div>
  <GpsBar pos={pos}/>
  <Field label={`Zone radius: ${c.radius} m`} hint="The zone is centred on you. Tap the map to move it. Keep it to public ground."><input type="range" min="100" max="1500" step="50" value={c.radius} onChange={e=>set('radius')(+e.target.value)} className="w-full accent-[#13201A]"/></Field>
  <Pick label="Game length" v={c.duration} o={[10,15,20,30,60]} set={set('duration')} fmt={x=>x+'m'}/>
  <Pick label="Ping every" v={c.ping_interval} o={[1,2,3,5]} set={set('ping_interval')} fmt={x=>x+'m'}/>
  <Pick label="Tag range" v={c.catch_radius} o={[5,10,20,30]} set={set('catch_radius')} fmt={x=>x+'m'}/>
  {c.catch_radius===5&&<p className="text-sm font-semibold text-mute -mt-2">5 m is hardcore: two phones' GPS can disagree by 5–10 m. Play in open ground with green GPS on both phones.</p>}
  <Pick label="Hide time" v={c.hide_time} o={[1,2,3]} set={set('hide_time')} fmt={x=>x+'m'}/>
  <Pick label="Hunters" v={c.hunters} o={[1,2,3]} set={set('hunters')}/>
  <Err>{err||gpsErr}</Err><Btn disabled={!ctr||busy} onClick={make}>Open squad</Btn></Screen>
}

function Join({agent,go}){
 const[code,setCode]=useState(''),[err,setErr]=useState(),[busy,setBusy]=useState(false)
 const join=async e=>{e.preventDefault();setBusy(true);setErr();try{
  const{data:lid,error:fe}=await sb.rpc('find_lobby',{p_code:code});if(fe)throw fe;if(!lid)throw Error('No open squad with that code.')
  const l={id:lid}
  let{data:p}=await sb.from('players').select().eq('lobby_id',l.id).eq('user_id',agent.id).maybeSingle()
  if(!p){const r=await sb.from('players').insert({lobby_id:l.id,user_id:agent.id,role:'shadow'}).select().single();if(r.error)throw r.error;p=r.data}
  go({v:'lobby',lid:l.id,me:p.id})}catch(e){setErr(e.message);setBusy(false)}}
 return <Screen title="Join squad" kicker="ShadowHunt" onBack={()=>go({v:'menu'})}><form onSubmit={join} className="flex flex-col gap-4">
  <Field label="Squad code"><input className={inputCls+' wide text-4xl text-center tracking-[.3em] uppercase'} value={code} onChange={e=>setCode(e.target.value)} maxLength={4} autoCapitalize="characters" placeholder="7K2P"/></Field>
  <Err>{err}</Err><Btn type="submit" disabled={code.length<4||busy}>Join as {agent.callsign}</Btn></form></Screen>
}

/* One server round trip per phone every ~4 s: sends position (when in a game), gets the whole game state
   plus server time. No live connections, so there is no connection cap; the server runs the game clock. */
function useTick(meId,posRef){
 const[st,setSt]=useState(),[lagging,setLag]=useState(false),last=useRef(Date.now()),kick=useRef()
 useEffect(()=>{let alive=true,t,fails=0
  const run=async()=>{clearTimeout(t);const p=posRef.current
   const{data,error}=await sb.rpc('game_tick',{p_player:meId,p_lat:p?.lat??null,p_lng:p?.lng??null,p_acc:p?.acc??null})
   if(!alive)return
   if(error||!data){fails++;setLag(Date.now()-last.current>12000)}
   else{fails=0;last.current=Date.now();setLag(false)
    setSt(data.gone?{gone:true}:{...data,offset:new Date(data.now).getTime()-Date.now()})}
   const base=data?.lobby?.status==='waiting'?3000:4000
   t=setTimeout(run,fails?Math.min(15000,base*2**fails):base)}
  kick.current=run;t=setTimeout(run,Math.random()*800)
  const vis=()=>{if(document.visibilityState==='visible')run()};document.addEventListener('visibilitychange',vis)
  return()=>{alive=false;clearTimeout(t);document.removeEventListener('visibilitychange',vis)}},[meId])
 return[st,lagging,()=>kick.current?.()]
}

function Lobby({s,go,exit}){
 const posRef=useRef(),[st,lagging,refresh]=useTick(s.me,posRef),l=st?.gone?null:st?.lobby,ps=st?.players||[]
 if(!l)return <div className="p-6 flex flex-col gap-4"><p className="text-mute font-semibold">{st?.gone?'This squad was closed by the host.':'Connecting to squad…'}</p><Btn v="ghost" onClick={exit}>Back to HQ</Btn></div>
 if(l.status!=='waiting')return <Game l={l} ps={ps} meId={s.me} exit={exit} st={st} posRef={posRef} lagging={lagging} refresh={refresh}/>
 const me=ps.find(p=>p.id===s.me)||{},c=l.config,H=ps.filter(p=>p.role==='hunter').length
 const setRole=(id,role)=>sb.from('players').update({role}).eq('id',id).then(refresh)
 const rnd=()=>[...ps].sort(()=>Math.random()-.5).forEach((p,i)=>setRole(p.id,i<c.hunters?'hunter':'shadow'))
 const start=()=>sb.rpc('start_hunt',{p_lobby:l.id}).then(({error})=>{if(error)alert(error.message);refresh()})
 const ok=ps.length>=2&&H>=1&&H<=3&&ps.length>H
 return <Screen title={l.code} kicker="Squad code" onBack={()=>go({v:'menu'})} right={<button onClick={()=>share(`Join my Safehouse squad: code ${l.code} ${location.origin}`)} className="rounded-md bg-signal text-ink font-extrabold px-4 py-2 mb-0.5">Share</button>}>
  <div className="relative h-40 -mx-4 -mt-4 border-b-2 border-ink"><OpsMap center={{lat:c.zone_lat,lng:c.zone_lng}} zoom={15} circles={[{lat:c.zone_lat,lng:c.zone_lng,r:c.radius,color:'#2563eb'}]}/></div>
  <Card className="p-3 text-base"><b>How it works:</b> tap a role to switch it. Hunters search; shadows hide for {c.hide_time} min, then get pinged every {c.ping_interval} min. Tag range is {c.catch_radius} m. Green ⌂ safehouses in the zone give shadows a one-time truce. Last shadow standing wins.</Card>
  <p className="text-mute font-semibold">2–10 agents, up to 3 hunters · {ps.length} in · {H} hunter{H===1?'':'s'} · {c.duration} min game</p>
  <ul className="flex flex-col gap-2">{ps.map(p=><li key={p.id} className="flex items-center gap-3 rounded-md border-2 border-ink bg-card p-2.5">
   <span className="size-10 rounded grid place-items-center stencil text-2xl bg-ink text-paper">{p.name[0]}</span>
   <span className="flex-1 font-bold text-lg truncate">{p.name}{p.id===s.me?' (you)':''}</span>
   <button disabled={!me.is_host} onClick={()=>setRole(p.id,p.role==='hunter'?'shadow':'hunter')} className={'rounded-md border-2 border-ink px-3 py-1.5 font-extrabold '+(p.role==='hunter'?'bg-alert text-paper border-alert':'bg-paper')}>{p.role==='hunter'?'Hunter':'Shadow'}</button></li>)}</ul>
  {me.is_host?<div className="mt-auto flex flex-col gap-3"><Btn v="ghost" onClick={rnd}>Random roles</Btn><Btn disabled={!ok} onClick={start}>Start op</Btn>{!ok&&<p className="text-center text-mute">Needs 2+ agents, 1–3 hunters and at least 1 shadow.</p>}</div>
   :<p className="mt-auto text-center font-semibold text-mute py-4">Waiting for the host to start…</p>}
  <button onClick={()=>leave(l.id,me.is_host,false,exit)} className="font-bold text-alert">{me.is_host?'Close squad':'Leave squad'}</button></Screen>
}

export function Game({l,ps,meId,exit,st={},posRef:sharedPos,lagging,refresh=()=>{}}){
 const c=l.config,me=ps.find(p=>p.id===meId)||{},host=me.is_host
 const[pos,gpsErr]=useGeo(),now=useNow()+(st.offset||0),[msg,setMsg]=useState(),[brief,setBrief]=useState(true),[shs,setShs]=useState([])
 const pins=st.pings||[],shel=st.shelters||[],pi=st.ping
 useEffect(()=>{if(sharedPos)sharedPos.current=pos},[pos])
 const t0=new Date(l.started_at).getTime(),hEnd=t0+c.hide_time*6e4,end=hEnd+c.duration*6e4
 const phase=l.status==='finished'?'done':now<hEnd?'hide':'hunt'
 const step=phase==='hunt'?Math.max(l.shrink_step||0,Math.floor((now-hEnd)/6e5)):0,r=c.radius*0.75**step
 const outside=!!pos&&phase!=='done'&&dist(pos.lat,pos.lng,c.zone_lat,c.zone_lng)>r,out=outside&&phase==='hunt'
 const shadowAlive=me.role==='shadow'&&me.status==='alive',grace=me.out_since?Math.max(0,30-Math.floor((now-new Date(me.out_since))/1000)):30
 useEffect(()=>{sb.from('safehouses').select('id,name,lat,lng,radius,truce_sec').then(({data})=>setShs((data||[]).filter(s=>dist(s.lat,s.lng,c.zone_lat,c.zone_lng)<=c.radius)))},[])
 useEffect(()=>{if(!out)return;const v=()=>navigator.vibrate?.([300,150,300]);v();const i=setInterval(v,5000);return()=>clearInterval(i)},[out])
 if(phase==='done')return <HuntDone l={l} ps={ps} me={me} hEnd={hEnd} end={end} exit={exit}/>
 const truce=id=>{const t=Math.max(0,...shel.filter(x=>x.player_id===id).map(x=>new Date(x.ends_at)-now));return t>0?t/1000:0}
 const myTruce=truce(meId),liveShs=shs.filter(s=>dist(s.lat,s.lng,c.zone_lat,c.zone_lng)<=r)
 const usedHere=pos&&shadowAlive&&!myTruce?liveShs.find(s=>dist(pos.lat,pos.lng,s.lat,s.lng)<=s.radius&&shel.some(x=>x.player_id===meId&&x.safehouse_id===s.id)):null
 const mp=pins.map(p=>{const age=(now-new Date(p.pat))/1000;return{lat:p.plat,lng:p.plng,fade:Math.max(.3,1-age/300),label:truce(p.pid)?`${p.pname} · SAFE ${fmt(truce(p.pid))}`:`${p.pname} · ${p.plive?'LIVE':Math.round(age)+'s ago'}`}})
 const near=me.role==='hunter'&&pos?pins.filter(p=>ps.find(x=>x.id===p.pid)?.role==='shadow'&&dist(pos.lat,pos.lng,p.plat,p.plng)<=c.catch_radius+20):[]
 const tag=async p=>{const{data}=await sb.rpc('verify_catch',{p_shadow:p.pid});setMsg(data?`Tagged ${p.pname}.`:`Not close enough to ${p.pname}. Keep moving.`);refresh();setTimeout(()=>setMsg(),3000)}
 const hunter=me.role==='hunter'
 const bear=(a,b,c2,d)=>{const t=Math.PI/180,y=Math.sin((d-b)*t)*Math.cos(c2*t),x=Math.cos(a*t)*Math.sin(c2*t)-Math.sin(a*t)*Math.cos(c2*t)*Math.cos((d-b)*t);return(Math.atan2(y,x)/t+360)%360}
 const scope=pos?pins.filter(p=>ps.find(x=>x.id===p.pid)?.role==='shadow').map(p=>{const age=(now-new Date(p.pat))/1000,dd=dist(pos.lat,pos.lng,p.plat,p.plng);return{brg:bear(pos.lat,pos.lng,p.plat,p.plng),dist:dd,color:'#C8231A',label:Math.round(dd)+'m',fade:Math.max(.35,1-age/180)}}):[]
 const scopeR=Math.min(Math.max(100,Math.ceil(Math.max(0,...scope.map(b=>b.dist))*1.15/50)*50),c.radius*2)
 return <div className="h-dvh relative overflow-hidden">
  <OpsMap center={{lat:c.zone_lat,lng:c.zone_lng}} zoom={16} me={pos}
   pins={[...liveShs.map(s=>{const n=shel.filter(x=>x.safehouse_id===s.id&&new Date(x.ends_at)>now).length;return{lat:s.lat,lng:s.lng,color:'#1E7343',label:`⌂ ${s.name} · ${s.truce_sec/60}m${n?` · ${n} inside`:''}`}}),...mp]}
   circles={[{lat:c.zone_lat,lng:c.zone_lng,r,color:'#2563eb'},...liveShs.map(s=>({lat:s.lat,lng:s.lng,r:s.radius,color:'#1E7343',fill:'#1E7343'}))]}/>
  <div className="absolute top-0 inset-x-0 z-[1000] bg-ink text-paper px-4 pt-[max(.75rem,env(safe-area-inset-top))] pb-3">
   <div className="flex justify-between items-center mb-1"><span className="text-sm font-bold text-paper/70">Squad {l.code} · {hunter?'Hunter':'Shadow'}</span><button onClick={()=>leave(l.id,host,true,exit)} className="rounded border-2 border-paper/60 px-2.5 py-0.5 text-sm font-extrabold">{host?'End op':'Exit'}</button></div>
   {phase==='hide'?<div className="flex items-end justify-between gap-3"><div><div className="text-sm text-paper/70 font-semibold">{hunter?'Wait. Hunt starts in':'Find a spot. Hiding ends in'}</div><div className="stencil text-3xl">{hunter?'Hunters hold':'Shadows hide'}</div></div><div className="wide text-3xl font-black text-signal tabular-nums">{fmt((hEnd-now)/1000)}</div></div>
   :<div className="flex items-end justify-between gap-3"><div><div className="text-sm text-paper/70 font-semibold">Zone shrinks in {fmt((hEnd+(step+1)*6e5-now)/1000)}</div><div className="stencil text-3xl">{hunter?'Hunt':'Stay hidden'}</div></div><div className="wide text-3xl font-black text-signal tabular-nums">{fmt((end-now)/1000)}</div></div>}
   {myTruce>0&&shadowAlive&&<div className="mt-2 rounded bg-ok p-2 font-extrabold">Safehouse truce: {fmt(myTruce)} left. You can't be tagged or pinged. Move on before it ends; each safehouse works once.</div>}
   {usedHere&&<div className="mt-2 rounded bg-paper/15 p-2 font-bold">You've already used {usedHere.name}. Find another safehouse.</div>}
   {outside&&shadowAlive&&!myTruce&&<div className="mt-2 rounded bg-alert p-2 font-extrabold">{phase==='hide'?'Get inside the circle before hiding ends.':`Outside the zone! Everyone can see you. Get back in within ${grace}s or you're out.`}</div>}
   {out&&!shadowAlive&&<div className="mt-2 rounded bg-alert p-2 font-extrabold">You're outside the zone. Everyone can see you.</div>}
   {shadowAlive&&phase==='hunt'&&!myTruce&&pi?.every&&pi.every<c.ping_interval*60&&<div className="mt-2 rounded bg-alert/90 p-2 font-extrabold">Hunter about {pi.near} m away. You're revealed every {pi.every} s.</div>}
   {shadowAlive&&phase==='hunt'&&!myTruce&&pi?.every&&<div className="mt-1 text-sm font-semibold text-paper/70">Next ping in {pi.next}s</div>}
   {me.status==='out'&&<div className="mt-2 rounded bg-signal text-ink p-2 font-extrabold">You left the zone, so you're out. You hunt now.</div>}
   {me.status==='caught'&&<div className="mt-2 rounded bg-signal text-ink p-2 font-extrabold">You were tagged. You hunt now.</div>}</div>
  {hunter&&phase==='hunt'&&pos&&<div className="absolute left-3 top-36 z-[1000] rounded-full shadow-lg"><Scope size={132} range={scopeR} blips={scope}/></div>}
  <div className="absolute bottom-0 inset-x-0 z-[1000] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] space-y-2">
   {brief&&me.role&&<Card className="p-3"><div className="stencil text-3xl">{hunter?'You are a hunter':'You are a shadow'}</div>
    <p className="mt-1 font-semibold">{hunter?`Wait out the hide timer. Then shadows ping every ${c.ping_interval} min, and faster as you close in (down to every 15 s within 50 m). The radar shows their bearing and distance. Walk to a pin; within ${c.catch_radius} m a Tag button appears. Shadows in a green ⌂ safehouse can't be tagged until their truce ends, so wait outside.`:`Get to a hiding spot inside the circle before the timer ends. You're revealed every ${c.ping_interval} min, and faster when a hunter gets close (every 15 s within 50 m). Stay inside the circle: 30 s outside and you're out. Green ⌂ safehouses give a truce (no tags, no pings) once each.`}</p>
    <button onClick={()=>setBrief(false)} className="mt-2 font-extrabold underline">Got it</button></Card>}
   {lagging&&<Err>Weak connection. Reconnecting… keep the app open.</Err>}
   <GpsBar pos={pos}/>{gpsErr&&<Err>{gpsErr}</Err>}{msg&&<Card className="p-2 text-center font-extrabold">{msg}</Card>}
   {near.map(p=>truce(p.pid)?<Card key={p.pid} className="p-2 text-center font-extrabold">{p.pname} is in a safehouse truce for {fmt(truce(p.pid))}. Wait outside.</Card>:<Btn key={p.pid} onClick={()=>tag(p)}>Tag {p.pname}</Btn>)}</div></div>
}

function HuntDone({l,ps,me,hEnd,end,exit}){
 const[xp,setXp]=useState(),[st,setSt]=useState([]),[cs,setCs]=useState([])
 useEffect(()=>{if(l.status!=='finished')return
  sb.rpc('award_hunt',{p_lobby:l.id}).then(r=>setXp(r.data??0));sb.rpc('get_stats',{p_lobby:l.id}).then(r=>setSt(r.data||[]));sb.from('catches').select().eq('lobby_id',l.id).then(r=>setCs(r.data||[]))},[l.status])
 if(l.status!=='finished')return <div className="p-6 flex flex-col gap-4"><p className="text-mute font-semibold">Time's up. Waiting for the host to close the op…</p><Btn v="ghost" onClick={exit}>Back to HQ</Btn></div>
 const won=ps.some(p=>p.role==='shadow'&&p.status==='alive'),total=st.reduce((a,x)=>a+x.pdist,0)
 const cnt={};cs.forEach(x=>cnt[x.hunter_id]=(cnt[x.hunter_id]||0)+1)
 const hid=ps.map(p=>{if(p.role==='shadow')return[p.name,end-hEnd];const k=cs.find(x=>x.shadow_id===p.id);return k?[p.name,new Date(k.created_at)-hEnd]:null}).filter(Boolean).sort((a,b)=>b[1]-a[1])[0]
 return <Screen title={won?'Shadows won':'Hunters won'} kicker={`Squad ${l.code}`}>
  <div className="py-4 text-center"><Stamp c={won?'ink':'alert'}>{won?'Escaped':'Caught'}</Stamp></div>
  <Card className="p-4 grid grid-cols-3 text-center">{[[xp==null?'…':'+'+xp,'your XP'],[ps.length,'agents'],[km(total),'km total']].map(([v,k])=><div key={k}><div className="wide text-3xl font-black">{v}</div><div className="text-mute">{k}</div></div>)}</Card>
  <ul className="text-lg space-y-1">{hid&&<li>Longest hidden: <b>{hid[0]}</b> ({fmt(hid[1]/1000)})</li>}{ps.filter(p=>cnt[p.id]).map(p=><li key={p.id}><b>{p.name}</b>: {cnt[p.id]} tag{cnt[p.id]>1?'s':''}</li>)}</ul>
  <div className="mt-auto flex flex-col gap-3"><Btn v="ghost" onClick={()=>share(`${won?'Shadows':'Hunters'} won our Safehouse op: ${ps.length} agents, ${km(total)} km on foot.`)}>Share result</Btn><Btn onClick={exit}>Back to HQ</Btn></div></Screen>
}
