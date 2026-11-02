import {useEffect,useRef,useState} from 'react'
import {sb,useGeo,useNow,dist,fmt,code4,km,share} from './lib'
import {Btn,Screen,Pick,Field,inputCls,Err,Stamp,Card,GpsBar,Title,Hz,Attrib} from './ui'
import {Back,Stop,Shield,Mask,Home,Plus,Trash,Target} from './icons'
import Guide,{HUNT,seen,mark} from './Tour'
import OpsMap from './OpsMap'
import Scope from './Scope'
/* Display names. The database keeps 'hunter' / 'shadow'. */
export const RL={hunter:'Police',shadow:'Kallan'}
const LIME='#A3D67F',AMBER='#E9B949',SAFE='#7FC8BB',RED='#E5584F'
const DEF={radius:400,duration:20,ping_interval:3,catch_radius:20,hide_time:2,hunters:1,shrink_every:10,sh_cooldown:0,caught_police:true,public_sh:true}
const cfg=c=>({...DEF,...c})
const leave=async(lid,host,running,exit)=>{
 if(!confirm(host?(running?'End this op for everyone?':'Close this squad for everyone?'):(running?'Leave this op? You get no XP for it.':'Leave this squad?')))return
 await sb.rpc('leave_hunt',{p_lobby:lid});exit()}
const reuse=c=>c.sh_cooldown?`can be reused ${c.sh_cooldown} min after you leave it`:'can be used once per game'
/* safehouses this hunt uses: the host's own plus, if allowed, admin ones inside the zone */
function useSafehouses(l,tick=0){
 const[shs,setShs]=useState([]),c=cfg(l.config)
 useEffect(()=>{let live=true
  Promise.all([sb.from('safehouses').select('id,name,lat,lng,radius,truce_sec,lobby_id').eq('lobby_id',l.id).eq('active',true),
   c.public_sh?sb.from('safehouses').select('id,name,lat,lng,radius,truce_sec,lobby_id').is('lobby_id',null).eq('active',true):Promise.resolve({data:[]})])
  .then(([a,b])=>{if(!live)return;setShs([...(a.data||[]),...(b.data||[]).filter(s=>dist(s.lat,s.lng,c.zone_lat,c.zone_lng)<=c.radius)])})
  return()=>{live=false}},[l.id,c.public_sh,tick])
 return shs
}

export default function Hunt({agent,onExit}){
 const[s,setS]=useState(()=>JSON.parse(localStorage.getItem('sh_hunt')||'{"v":"menu"}'))
 const go=x=>{x.v==='menu'?localStorage.removeItem('sh_hunt'):localStorage.setItem('sh_hunt',JSON.stringify(x));setS(x)}
 const exit=()=>{localStorage.removeItem('sh_hunt');onExit()}
 const[help,setHelp]=useState(()=>!seen('sh_hunt_guide2'))
 if(s.v==='create')return <Create agent={agent} go={go}/>
 if(s.v==='join')return <Join agent={agent} go={go}/>
 if(s.v==='lobby')return <Lobby s={s} go={go} exit={exit}/>
 return <Screen title="ShadowHunt" kicker="Squad op · 2–10 agents" onBack={onExit}>
  {help&&<Guide slides={HUNT} label="Let's go" onDone={()=>{mark('sh_hunt_guide2');setHelp(false)}}/>}
  <div className="grid grid-cols-2 gap-3">
   <Card className="p-4"><Mask className="size-9 text-signal"/><div className="stencil text-2xl mt-2">Kallan</div><p className="text-mute text-[.95rem] mt-1">Hide inside the zone. Duck into a safehouse to vanish from the map for a while.</p></Card>
   <Card className="p-4"><Shield className="size-9 text-amber"/><div className="stencil text-2xl mt-2">Police</div><p className="text-mute text-[.95rem] mt-1">See Kallan only on timed pings. Close in and tag them before time runs out.</p></Card></div>
  <ol className="flex flex-col gap-2 text-lg">{['Create a squad and send the 4-letter code to friends.','The host sets the rules, places safehouses and picks roles.','Kallan hide. Then the hunt begins and the zone keeps shrinking.'].map((t,i)=><li key={i} className="flex gap-3"><span className="wide text-signal w-4 shrink-0">{i+1}</span>{t}</li>)}</ol>
  <button onClick={()=>setHelp(true)} className="underline underline-offset-4 font-semibold text-mute text-left">Read the full rules</button>
  <div className="mt-auto flex flex-col gap-3"><Btn onClick={()=>go({v:'create'})}>Create squad</Btn><Btn v="ghost" onClick={()=>go({v:'join'})}>Join with code</Btn></div></Screen>
}

const Section=({title,children})=><Card className="p-4 flex flex-col gap-4"><h2 className="stencil text-xl flex items-center">{title}<Hz/></h2>{children}</Card>

function Create({agent,go}){
 const[pos,gpsErr]=useGeo(),[ctr,setCtr]=useState(),[err,setErr]=useState(),[busy,setBusy]=useState(false)
 const[c,setC]=useState(DEF)
 const set=k=>v=>setC(o=>({...o,[k]:v}))
 useEffect(()=>{if(!ctr&&pos&&pos.acc<=100)setCtr({lat:pos.lat,lng:pos.lng})},[pos,ctr])
 const make=async()=>{setBusy(true);setErr();try{
  let l,e;for(let k=0;k<4;k++){({data:l,error:e}=await sb.from('lobbies').insert({code:code4(),host_id:agent.id,config:{zone_lat:ctr.lat,zone_lng:ctr.lng,...c}}).select().single());if(!e||e.code!=='23505')break}
  if(e)throw e
  const{data:p,error:e2}=await sb.from('players').insert({lobby_id:l.id,user_id:agent.id,is_host:true,role:'hunter'}).select().single();if(e2)throw e2
  go({v:'lobby',lid:l.id,me:p.id})}catch(e){setErr(e.message);setBusy(false)}}
 return <Screen title="New squad" kicker="ShadowHunt" onBack={()=>go({v:'menu'})}>
  <div className="relative h-60 rounded-2xl overflow-hidden border border-line">{ctr?<OpsMap center={ctr} zoom={15} me={pos} ctl="right-2 top-2" circles={[{...ctr,r:c.radius,color:LIME}]} onPick={(lat,lng)=>setCtr({lat,lng})}/>:<div className="p-4"><p className="text-mute font-semibold mb-2">Waiting for a precise GPS fix…</p>{pos&&<Btn v="ghost" onClick={()=>setCtr({lat:pos.lat,lng:pos.lng})}>Use rough position anyway</Btn>}</div>}</div>
  <GpsBar pos={pos}/>
  <Section title="Zone">
   <Field label={`Zone radius: ${c.radius} m`} hint="The zone is centred on you. Tap the map to move it. Keep it to public ground."><input type="range" min="100" max="1500" step="50" value={c.radius} onChange={e=>set('radius')(+e.target.value)} className="w-full accent-[#A3D67F]"/></Field>
   <Pick label="Zone shrinks every" v={c.shrink_every} o={[3,5,10,15]} set={set('shrink_every')} fmt={x=>x+' min'}/>
   <p className="text-sm text-mute -mt-2">Each shrink cuts the radius by a quarter.</p></Section>
  <Section title="Game">
   <Pick label="Game length" v={c.duration} o={[10,15,20,30,60]} set={set('duration')} fmt={x=>x+'m'}/>
   <Pick label="Hide time" v={c.hide_time} o={[1,2,3]} set={set('hide_time')} fmt={x=>x+'m'}/>
   <Pick label="Ping every" v={c.ping_interval} o={[1,2,3,5]} set={set('ping_interval')} fmt={x=>x+'m'}/>
   <Pick label="Tag range" v={c.catch_radius} o={[5,10,20,30]} set={set('catch_radius')} fmt={x=>x+'m'}/>
   {c.catch_radius===5&&<p className="text-sm text-mute -mt-2">5 m is hardcore: two phones' GPS can disagree by 5–10 m. Play in open ground with green GPS on both phones.</p>}
   <Pick label="Police at start" v={c.hunters} o={[1,2,3]} set={set('hunters')}/></Section>
  <Section title="Rules">
   <Pick label="A caught Kallan" v={c.caught_police} o={[[true,'Becomes Police'],[false,'Is out']]} set={set('caught_police')}/>
   <Pick label="Safehouse reuse" v={c.sh_cooldown} o={[[0,'Once'],[5,'5 min'],[10,'10 min'],[15,'15 min']]} set={set('sh_cooldown')}/>
   <p className="text-sm text-mute -mt-2">{c.sh_cooldown?`A Kallan can use the same safehouse again ${c.sh_cooldown} minutes after leaving it.`:'Each Kallan can use each safehouse once per game.'}</p>
   <Pick label="Public safehouses" v={c.public_sh} o={[[true,'Include'],[false,'Mine only']]} set={set('public_sh')}/>
   <p className="text-sm text-mute -mt-2">You place your own safehouses in the lobby, each with its own hiding time.</p></Section>
  <Err>{err||gpsErr}</Err><Btn disabled={!ctr||busy} onClick={make}>Open squad</Btn></Screen>
}

function Join({agent,go}){
 const[code,setCode]=useState(''),[err,setErr]=useState(),[busy,setBusy]=useState(false)
 const join=async e=>{e.preventDefault();setBusy(true);setErr();try{
  const{data:lid,error:fe}=await sb.rpc('find_lobby',{p_code:code});if(fe)throw fe;if(!lid)throw Error('No open squad with that code.')
  let{data:p}=await sb.from('players').select().eq('lobby_id',lid).eq('user_id',agent.id).maybeSingle()
  if(!p){const r=await sb.from('players').insert({lobby_id:lid,user_id:agent.id,role:'shadow'}).select().single();if(r.error)throw r.error;p=r.data}
  go({v:'lobby',lid,me:p.id})}catch(e){setErr(e.message);setBusy(false)}}
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

const RoleChip=({role,onClick,disabled})=>{const P=role==='hunter'
 return <button disabled={disabled} onClick={onClick} className={'rounded-lg border px-3 py-1.5 wide text-base inline-flex items-center gap-1.5 disabled:opacity-100 '+(P?'border-amber text-amber':'border-signal text-signal')}>
  {P?<Shield className="size-4"/>:<Mask className="size-4"/>}{RL[role]}</button>}

function Lobby({s,go,exit}){
 const posRef=useRef(),[st,lagging,refresh]=useTick(s.me,posRef),l=st?.gone?null:st?.lobby,ps=st?.players||[]
 if(!l)return <div className="p-6 flex flex-col gap-4"><p className="text-mute font-semibold">{st?.gone?'This squad was closed by the host.':'Connecting to squad…'}</p><Btn v="ghost" onClick={exit}>Back to HQ</Btn></div>
 if(l.status!=='waiting')return <Game l={l} ps={ps} meId={s.me} exit={exit} st={st} posRef={posRef} lagging={lagging} refresh={refresh}/>
 return <Waiting l={l} ps={ps} s={s} go={go} exit={exit} refresh={refresh}/>
}

function Waiting({l,ps,s,go,exit,refresh}){
 const me=ps.find(p=>p.id===s.me)||{},c=cfg(l.config),H=ps.filter(p=>p.role==='hunter').length,host=!!me.is_host
 const[tick,setTick]=useState(0),shs=useSafehouses(l,tick),mine=shs.filter(x=>x.lobby_id)
 const[draft,setDraft]=useState(),[place,setPlace]=useState(false),[f,setF]=useState({name:'',truce:2,radius:25}),[err,setErr]=useState(),[busy,setBusy]=useState(false)
 const setRole=(id,role)=>sb.from('players').update({role}).eq('id',id).then(refresh)
 const rnd=()=>[...ps].sort(()=>Math.random()-.5).forEach((p,i)=>setRole(p.id,i<c.hunters?'hunter':'shadow'))
 const start=()=>sb.rpc('start_hunt',{p_lobby:l.id}).then(({error})=>{if(error)alert(error.message);refresh()})
 const ok=ps.length>=2&&H>=1&&H<=3&&ps.length>H
 const add=async()=>{setBusy(true);setErr();const{error}=await sb.rpc('hunt_sh_add',{p_lobby:l.id,p_name:f.name||`Safehouse ${mine.length+1}`,p_lat:draft.lat,p_lng:draft.lng,p_radius:f.radius,p_truce_sec:f.truce*60});setBusy(false)
  if(error)return setErr(error.message);setDraft();setF({...f,name:''});setTick(t=>t+1)}
 const del=async id=>{await sb.rpc('hunt_sh_del',{p_id:id});setTick(t=>t+1)}
 const onPick=host&&place?(lat,lng)=>{setErr();if(dist(lat,lng,c.zone_lat,c.zone_lng)>c.radius)return setErr('Place the safehouse inside the zone.');setDraft({lat,lng})}:undefined
 return <Screen title={l.code} kicker="Squad code" onBack={()=>go({v:'menu'})} right={<button onClick={()=>share(`Join my Safehouse squad: code ${l.code} ${location.origin}`)} className="rounded-xl bg-signal text-onsig wide text-lg px-4 py-2 mb-0.5">Share</button>}>
  <div className="relative h-60 rounded-2xl overflow-hidden border border-line">
   <OpsMap center={{lat:c.zone_lat,lng:c.zone_lng}} zoom={15} ctl="right-2 top-2" onPick={onPick}
    circles={[{lat:c.zone_lat,lng:c.zone_lng,r:c.radius,color:LIME},...shs.map(x=>({lat:x.lat,lng:x.lng,r:x.radius,color:SAFE,fill:SAFE})),...(draft?[{...draft,r:f.radius,color:AMBER,fill:AMBER,dash:true}]:[])]}
    pins={[...shs.map(x=>({lat:x.lat,lng:x.lng,color:SAFE,ring:false,label:`⌂ ${x.name} · ${x.truce_sec/60} min`})),...(draft?[{...draft,color:AMBER,label:'New safehouse'}]:[])]}/>
   {place&&!draft&&<div className="absolute left-2 bottom-2 right-16 z-[1000] rounded-xl bg-panel/90 border border-amber px-3 py-2 text-sm font-semibold">Tap the map inside the zone to place a safehouse.</div>}</div>

  <Card className="p-4 text-[.95rem] leading-relaxed"><h2 className="stencil text-xl flex items-center mb-1">Rules<Hz/></h2>
   Kallan hide for {c.hide_time} min, then get pinged every {c.ping_interval} min. The zone shrinks every {c.shrink_every} min. Tag range {c.catch_radius} m.
   A caught Kallan {c.caught_police?'becomes Police':'is out'}. Inside a safehouse a Kallan disappears from every map and can't be tagged. Each safehouse {reuse(c)} by each Kallan.</Card>

  <Card className="p-4 flex flex-col gap-3">
   <div className="flex items-center justify-between"><h2 className="stencil text-xl flex items-center">Safehouses<Hz/></h2>
    {host&&<button onClick={()=>{setPlace(!place);setDraft();setErr()}} aria-pressed={place} className={'rounded-lg border px-3 py-1.5 wide inline-flex items-center gap-1.5 '+(place?'border-amber text-amber':'border-line')}><Plus className="size-4"/>{place?'Done':'Place'}</button>}</div>
   {draft&&<div className="rounded-xl border border-amber/70 bg-amber/5 p-3 flex flex-col gap-3">
    <Field label="Name players see"><input className={inputCls} value={f.name} maxLength={40} onChange={e=>setF({...f,name:e.target.value})} placeholder={`Safehouse ${mine.length+1}`}/></Field>
    <Pick label="Hidden for" v={f.truce} o={[1,2,3,5]} set={v=>setF({...f,truce:v})} fmt={x=>x+' min'}/>
    <Pick label="Size" v={f.radius} o={[[15,'15 m'],[25,'25 m'],[40,'40 m']]} set={v=>setF({...f,radius:v})}/>
    <div className="flex gap-2"><Btn v="ghost" onClick={()=>setDraft()}>Cancel</Btn><Btn disabled={busy} onClick={add}>Add</Btn></div></div>}
   <Err>{err}</Err>
   {!shs.length?<p className="text-mute">{host?'No safehouses yet. Tap Place, then tap the map.':'The host hasn\'t placed any safehouses.'}</p>:
   <ul className="flex flex-col divide-y divide-line">{shs.map(x=><li key={x.id} className="flex items-center gap-3 py-2">
    <Home className="size-6 text-safe shrink-0"/><span className="flex-1 min-w-0"><span className="font-semibold block truncate">{x.name}</span><span className="text-sm text-mute">Hidden {x.truce_sec/60} min · {x.radius} m{x.lobby_id?'':' · public'}</span></span>
    {host&&x.lobby_id&&<button onClick={()=>del(x.id)} aria-label={`Remove ${x.name}`} className="size-10 grid place-items-center rounded-full text-mute hover:text-alert"><Trash className="size-5"/></button>}</li>)}</ul>}
  </Card>

  <p className="text-mute">2–10 agents, up to 3 Police · {ps.length} in · {H} Police · {c.duration} min game</p>
  <ul className="flex flex-col gap-2">{ps.map(p=><li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-2.5">
   <span className="size-10 rounded-full grid place-items-center stencil text-xl bg-raise border border-line">{p.name[0]}</span>
   <span className="flex-1 font-semibold text-lg truncate">{p.name}{p.id===s.me?' (you)':''}</span>
   <RoleChip role={p.role} disabled={!host} onClick={()=>setRole(p.id,p.role==='hunter'?'shadow':'hunter')}/></li>)}</ul>
  {host?<div className="mt-auto flex flex-col gap-3">{host&&<p className="text-sm text-mute text-center">Tap a role to switch it.</p>}<Btn v="ghost" onClick={rnd}>Random roles</Btn><Btn disabled={!ok} onClick={start}>Start op</Btn>{!ok&&<p className="text-center text-mute">Needs 2+ agents, 1–3 Police and at least 1 Kallan.</p>}</div>
   :<p className="mt-auto text-center font-semibold text-mute py-4">Waiting for the host to start…</p>}
  <button onClick={()=>leave(l.id,me.is_host,false,exit)} className="font-semibold text-alert py-2">{me.is_host?'Close squad':'Leave squad'}</button></Screen>
}

const bear=(a,b,c2,d)=>{const t=Math.PI/180,y=Math.sin((d-b)*t)*Math.cos(c2*t),x=Math.cos(a*t)*Math.sin(c2*t)-Math.sin(a*t)*Math.cos(c2*t)*Math.cos((d-b)*t);return(Math.atan2(y,x)/t+360)%360}
const Banner=({tone='alert',children})=><div className={'mt-2 rounded-xl px-3 py-2 font-semibold '+({alert:'bg-alert/15 border border-alert/70 text-ink',safe:'bg-safe/15 border border-safe/70 text-ink',info:'bg-raise border border-line text-ink',sig:'bg-signal/15 border border-signal/60 text-ink'}[tone])}>{children}</div>

export function Game({l,ps,meId,exit,st={},posRef:sharedPos,lagging,refresh=()=>{}}){
 const c=cfg(l.config),me=ps.find(p=>p.id===meId)||{},host=me.is_host
 const[pos,gpsErr]=useGeo(),now=useNow()+(st.offset||0),[msg,setMsg]=useState(),[brief,setBrief]=useState(true)
 const shs=useSafehouses(l),pins=st.pings||[],shel=st.shelters||[],pi=st.ping
 useEffect(()=>{if(sharedPos)sharedPos.current=pos},[pos])
 const t0=new Date(l.started_at).getTime(),hEnd=t0+c.hide_time*6e4,end=hEnd+c.duration*6e4,every=c.shrink_every*6e4
 const phase=l.status==='finished'?'done':now<hEnd?'hide':'hunt'
 const step=phase==='hunt'?Math.max(l.shrink_step||0,Math.floor((now-hEnd)/every)):0,r=c.radius*0.75**step
 const outside=!!pos&&phase!=='done'&&dist(pos.lat,pos.lng,c.zone_lat,c.zone_lng)>r,out=outside&&phase==='hunt'
 const kallanAlive=me.role==='shadow'&&me.status==='alive',grace=me.out_since?Math.max(0,30-Math.floor((now-new Date(me.out_since))/1000)):30
 useEffect(()=>{if(!out)return;const v=()=>navigator.vibrate?.([300,150,300]);v();const i=setInterval(v,5000);return()=>clearInterval(i)},[out])
 if(phase==='done')return <HuntDone l={l} ps={ps} me={me} hEnd={hEnd} end={end} exit={exit}/>
 const mine=shel.filter(x=>x.player_id===meId),active=mine.find(x=>new Date(x.ends_at)>now),myTruce=active?(new Date(active.ends_at)-now)/1000:0
 const liveShs=shs.filter(s=>dist(s.lat,s.lng,c.zone_lat,c.zone_lng)<=r)
 /* standing in a safehouse you can't use right now */
 const here=pos&&kallanAlive&&!myTruce?liveShs.find(s=>dist(pos.lat,pos.lng,s.lat,s.lng)<=s.radius):null
 const last=here?mine.filter(x=>x.safehouse_id===here.id).sort((a,b)=>new Date(b.ends_at)-new Date(a.ends_at))[0]:null
 const reopen=last&&c.sh_cooldown?(new Date(last.ends_at).getTime()+c.sh_cooldown*6e4-now)/1000:null
 const police=me.role==='hunter'
 const mp=pins.map(p=>{const age=(now-new Date(p.pat))/1000;return{lat:p.plat,lng:p.plng,color:p.plive?RED:AMBER,fade:Math.max(.35,1-age/300),label:`${p.pname} · ${p.plive?'live':Math.round(age)+'s ago'}`}})
 const near=police&&pos?pins.filter(p=>ps.find(x=>x.id===p.pid)?.role==='shadow'&&dist(pos.lat,pos.lng,p.plat,p.plng)<=c.catch_radius+20):[]
 const tag=async p=>{const{data}=await sb.rpc('verify_catch',{p_shadow:p.pid});setMsg(data?`Tagged ${p.pname}.`:`Not close enough to ${p.pname}, or they made it into a safehouse. Keep moving.`);refresh();setTimeout(()=>setMsg(),3500)}
 const scope=pos?pins.filter(p=>ps.find(x=>x.id===p.pid)?.role==='shadow').map(p=>{const age=(now-new Date(p.pat))/1000,dd=dist(pos.lat,pos.lng,p.plat,p.plng);return{brg:bear(pos.lat,pos.lng,p.plat,p.plng),dist:dd,color:AMBER,label:Math.round(dd)+'m',fade:Math.max(.35,1-age/180)}}):[]
 const scopeR=Math.min(Math.max(100,Math.ceil(Math.max(0,...scope.map(b=>b.dist))*1.15/50)*50),c.radius*2)
 const role=RL[me.role]||'Agent'
 return <div className="h-dvh flex flex-col">
  <header className="px-4 pt-[max(.9rem,env(safe-area-inset-top))] pb-2 flex items-center gap-3">
   <button onClick={()=>leave(l.id,host,true,exit)} aria-label={host?'End op':'Leave op'} className="size-10 -ml-1 grid place-items-center rounded-full hover:bg-raise"><Back/></button>
   <span className="flex-1 min-w-0 truncate wide text-xl">Squad {l.code} · <span className={police?'text-amber':'text-signal'}>{role}</span></span>
   <button onClick={()=>leave(l.id,host,true,exit)} className="rounded-xl border border-alert/70 text-ink px-3 py-1.5 wide text-lg inline-flex items-center gap-2"><Stop className="size-5 text-alert"/>{host?'End op':'Exit'}</button></header>
  <div className="px-3"><Card className="px-4 py-3">
   {phase==='hide'?<div className="flex items-end justify-between gap-3"><div className="min-w-0"><div className="text-mute uppercase tracking-wide text-sm">{police?'Wait. Hunt starts in':'Find a spot. Hiding ends in'}</div><Title className="text-3xl">{police?'Police hold':'Kallan hide'}</Title></div><div className="wide text-5xl tabular-nums leading-none">{fmt((hEnd-now)/1000)}</div></div>
   :<div className="flex items-end justify-between gap-3"><div className="min-w-0"><div className="text-mute uppercase tracking-wide text-sm">Zone shrinks in {fmt((hEnd+(step+1)*every-now)/1000)}</div><Title className="text-3xl">{police?'Hunt':'Stay hidden'}</Title></div><div className="wide text-5xl tabular-nums leading-none">{fmt((end-now)/1000)}</div></div>}
   {myTruce>0&&kallanAlive&&<Banner tone="safe">In safehouse · hidden for {fmt(myTruce)}. Police can't see or tag you. Leave before it ends. Each safehouse {reuse(c)}.</Banner>}
   {here&&<Banner tone="info">{reopen>0?`${here.name} reopens for you in ${fmt(reopen)}.`:`You've already used ${here.name}. Find another safehouse.`}</Banner>}
   {outside&&kallanAlive&&!myTruce&&<Banner>{phase==='hide'?'Get inside the circle before hiding ends.':`Outside the zone! Everyone can see you. Get back in within ${grace}s or you're out.`}</Banner>}
   {out&&!kallanAlive&&<Banner>You're outside the zone. Everyone can see you.</Banner>}
   {kallanAlive&&phase==='hunt'&&!myTruce&&pi?.every&&pi.every<c.ping_interval*60&&<Banner>Police about {pi.near} m away. You're revealed every {pi.every} s.</Banner>}
   {kallanAlive&&phase==='hunt'&&!myTruce&&pi?.every&&<div className="mt-1 text-sm text-mute">Next ping in {pi.next}s</div>}
   {me.status==='out'&&<Banner tone="sig">You left the zone, so you're out.{c.caught_police?' You\'re Police now.':' Watch the rest of the op.'}</Banner>}
   {me.status==='caught'&&<Banner tone="sig">You were tagged.{c.caught_police?' You\'re Police now.':' You\'re out; watch the rest of the op.'}</Banner>}
  </Card></div>
  <div className="relative flex-1 m-3 mb-2 rounded-2xl overflow-hidden border border-line">
   <OpsMap center={{lat:c.zone_lat,lng:c.zone_lng}} zoom={16} me={pos} ctl="right-3 top-3"
    pins={[...liveShs.map(s=>({lat:s.lat,lng:s.lng,color:SAFE,ring:false,label:`⌂ ${s.name} · ${s.truce_sec/60} min`})),...mp]}
    circles={[{lat:c.zone_lat,lng:c.zone_lng,r,color:LIME},...liveShs.map(s=>({lat:s.lat,lng:s.lng,r:s.radius,color:SAFE,fill:SAFE}))]}/>
   {police&&phase==='hunt'&&pos&&<div className="absolute left-3 top-3 z-[1000]"><Scope size={124} range={scopeR} blips={scope} labels={false}/></div>}
   {brief&&me.role&&<div className="absolute inset-x-2 bottom-2 z-[1000]"><Card className="p-4 bg-card/95 backdrop-blur flex gap-3">
    <div className="flex-1 min-w-0"><Title className="text-2xl">{police?'You are Police':'You are Kallan'}</Title>
     <p className="mt-1.5 text-[.95rem] leading-snug">{police?`Wait out the hide timer. Then Kallan ping every ${c.ping_interval} min, and faster as you close in (down to every 15 s within 50 m). The radar shows their bearing and distance. Within ${c.catch_radius} m of a pin a Tag button appears. A Kallan in a safehouse vanishes until their time there runs out.`
      :`Get to a hiding spot inside the circle before the timer ends. You're revealed every ${c.ping_interval} min, and faster when Police get close. Stay inside the circle: 30 s outside and you're out. Step into a ⌂ safehouse to vanish from every map for its set time.`}</p>
     <button onClick={()=>setBrief(false)} className="mt-3 rounded-xl bg-signal text-onsig wide text-lg px-6 py-2">Got it</button></div>
    {police?<Shield className="size-14 text-amber/70 shrink-0" sw={1.3}/>:<Mask className="size-14 text-signal/70 shrink-0" sw={1.3}/>}</Card></div>}
  </div>
  <div className="px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] space-y-2">
   {lagging&&<Err>Weak connection. Reconnecting… keep the app open.</Err>}
   {gpsErr&&<Err>{gpsErr}</Err>}{msg&&<Card className="p-2 text-center font-semibold">{msg}</Card>}
   {near.map(p=><Btn key={p.pid} onClick={()=>tag(p)}><Target className="size-6"/>Tag {p.pname}</Btn>)}
   <div className="flex items-center gap-3"><GpsBar pos={pos} detail={false}/><Attrib className="ml-auto"/></div></div></div>
}

function HuntDone({l,ps,me,hEnd,end,exit}){
 const[xp,setXp]=useState(),[st,setSt]=useState([]),[cs,setCs]=useState([])
 useEffect(()=>{if(l.status!=='finished')return
  sb.rpc('award_hunt',{p_lobby:l.id}).then(r=>setXp(r.data??0));sb.rpc('get_stats',{p_lobby:l.id}).then(r=>setSt(r.data||[]));sb.from('catches').select().eq('lobby_id',l.id).then(r=>setCs(r.data||[]))},[l.status])
 if(l.status!=='finished')return <div className="p-6 flex flex-col gap-4"><p className="text-mute font-semibold">Time's up. Waiting for the host to close the op…</p><Btn v="ghost" onClick={exit}>Back to HQ</Btn></div>
 const won=ps.some(p=>p.role==='shadow'&&p.status==='alive'),total=st.reduce((a,x)=>a+x.pdist,0)
 const cnt={};cs.forEach(x=>cnt[x.hunter_id]=(cnt[x.hunter_id]||0)+1)
 const hid=ps.map(p=>{if(p.role==='shadow'&&p.status==='alive')return[p.name,end-hEnd];const k=cs.find(x=>x.shadow_id===p.id);return k?[p.name,new Date(k.created_at)-hEnd]:null}).filter(Boolean).sort((a,b)=>b[1]-a[1])[0]
 return <Screen title={won?'Kallan escaped':'Police won'} kicker={`Squad ${l.code}`}>
  <div className="py-4 text-center"><Stamp c={won?'ok':'alert'}>{won?'Escaped':'Caught'}</Stamp></div>
  <Card className="p-4 grid grid-cols-3 text-center">{[[xp==null?'…':'+'+xp,'your XP'],[ps.length,'agents'],[km(total),'km total']].map(([v,k])=><div key={k}><div className="wide text-3xl">{v}</div><div className="text-mute">{k}</div></div>)}</Card>
  <ul className="text-lg space-y-1">{hid&&<li>Longest hidden: <b>{hid[0]}</b> ({fmt(hid[1]/1000)})</li>}{ps.filter(p=>cnt[p.id]).map(p=><li key={p.id}><b>{p.name}</b>: {cnt[p.id]} tag{cnt[p.id]>1?'s':''}</li>)}</ul>
  <div className="mt-auto flex flex-col gap-3"><Btn v="ghost" onClick={()=>share(`${won?'Kallan escaped':'Police won'} in our Safehouse op: ${ps.length} agents, ${km(total)} km on foot.`)}>Share result</Btn><Btn onClick={exit}>Back to HQ</Btn></div></Screen>
}
