import {useEffect,useState} from 'react'
import {rankOf,km,sb} from './lib'
import {Card,Hz} from './ui'
import {Menu,Pin,Badge,Steps,Timer,Layers,Box,Target,Bars,ChevR,X} from './icons'
import Radar from './Radar'
import {openFiles} from './story/Story'
const Op=({Icon,title,meta,desc,onClick})=><button onClick={onClick} className="text-left rounded-2xl border border-line bg-card p-4 flex items-center gap-4 hover:bg-raise">
 <Icon className="size-9 shrink-0 text-mute"/>
 <div className="flex-1 min-w-0"><div className="flex items-baseline justify-between gap-2"><span className="stencil text-2xl">{title}</span><span className="text-sm font-semibold whitespace-nowrap shrink-0 text-amber">{meta}</span></div>
  <p className="text-mute text-[.95rem] leading-snug mt-0.5">{desc}</p></div>
 <ChevR className="size-5 shrink-0 text-mute"/></button>
export default function HQ({agent,go,how}){
 const[sec,setSec]=useState(),[menu,setMenu]=useState(false);useEffect(()=>{sb.rpc('security_status').then(({data})=>setSec(data))},[])
 const r=rankOf(agent.xp),pct=r.next?Math.round((agent.xp-r.floor)/(r.next[0]-r.floor)*100):100,lv=String(Math.floor(agent.xp/200)+1).padStart(2,'0')
 return <div className="min-h-dvh flex flex-col gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
  <header className="flex items-center gap-3">
   <button onClick={()=>setMenu(true)} aria-label="Menu" className="size-11 rounded-xl border border-line grid place-items-center"><Menu/></button>
   <span className="stencil text-3xl flex-1 flex items-center">Safehouse<Hz/></span>
   <span className="inline-flex items-center gap-1 font-semibold"><Pin className="size-5"/>{agent.district}</span></header>
  <Card className="p-4">
   <div className="flex items-start gap-4">
    <Badge className="size-[4.5rem] shrink-0"/>
    <div className="flex-1 min-w-0"><div className="text-mute">{r.name}</div>
     <div className={`stencil [overflow-wrap:anywhere] ${agent.callsign.length>10?'text-3xl':'text-4xl'}`}>{agent.callsign}</div>
     <div className="text-sm text-mute mt-0.5">{agent.xp} XP{r.next?` · ${r.next[0]-agent.xp} to ${r.next[1]}`:' · top rank'}</div></div>
    <div className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-center leading-none"><div className="wide text-sm text-mute">LV</div><div className="wide text-2xl">{lv}</div></div></div>
   <div className="mt-3 h-2.5 rounded-full overflow-hidden" style={{background:'repeating-linear-gradient(-60deg,#2C3631 0 4px,#1C2520 4px 8px)'}} role="progressbar" aria-label={`Progress to ${r.next?.[1]||'top rank'}`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
    <div className="h-full bg-signal rounded-full" style={{width:pct+'%'}}/></div>
   <dl className="grid grid-cols-3 mt-4 border-t border-line pt-3">
    {[[Steps,km(agent.meters)+' km','Walked'],[Timer,Math.round(agent.active_sec/60)+' min','Active'],[Layers,agent.ops,'Ops run']].map(([Ic,v,l],i)=><div key={l} className={'flex items-center gap-2 px-1.5 min-w-0 '+(i?'border-l border-line':'')}>
     <Ic className="size-7 text-signal shrink-0"/><div className="min-w-0"><dd className="wide text-xl leading-tight whitespace-nowrap">{v}</dd><dt className="text-sm text-mute">{l}</dt></div></div>)}</dl>
  </Card>
  {sec&&!sec.cipher&&!sec.passkeys&&<button onClick={()=>go('secure')} className="text-left rounded-2xl border border-alert/70 bg-alert/10 p-3"><div className="font-bold text-alert">Back up your agent</div><div className="text-sm">Without a cipher or passkey, clearing the app loses your XP. Takes 30 seconds.</div></button>}
  <Radar go={go}/>
  <Op Icon={Box} title="Dead Drop" meta="Solo · 10–40 min" desc="A drop is hidden near you. Follow the signal and reach it before the clock runs out." onClick={()=>go('drop')}/>
  <Op Icon={Target} title="ShadowHunt" meta="Squad · 2–10" desc="Police see Kallan only on timed pings. The zone shrinks. Tag them before time's up." onClick={()=>go('hunt')}/>
  <Op Icon={Bars} title="Leaderboard" meta="Weekly" desc={`Top agents in ${agent.district} this week.`} onClick={()=>go('board')}/>
  <footer className="flex items-center gap-3 pt-1 whitespace-nowrap">
   <button onClick={how} className="underline underline-offset-4 font-semibold text-mute py-2">How to play</button>
   <span className="h-5 w-px bg-line" aria-hidden="true"/>
   <button onClick={()=>go('secure')} className="underline underline-offset-4 font-semibold text-mute py-2">Agent security</button>
   <button onClick={openFiles} className="ml-auto rounded-full border border-amber px-3.5 py-2 wide text-lg shrink-0 inline-flex items-center gap-2"><span className="size-3 rounded-full border-2 border-amber"/>Anchal Zero</button></footer>
  {menu&&<div className="fixed inset-0 z-[2000] bg-black/60" onClick={()=>setMenu(false)}>
   <nav aria-label="Menu" onClick={e=>e.stopPropagation()} className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-panel border-r border-line p-4 pt-[max(1rem,env(safe-area-inset-top))] flex flex-col gap-1">
    <div className="flex items-center justify-between mb-3"><span className="stencil text-2xl flex items-center">Menu<Hz/></span><button onClick={()=>setMenu(false)} aria-label="Close menu" className="size-10 grid place-items-center rounded-full hover:bg-raise"><X/></button></div>
    {[['Dead Drop',()=>go('drop')],['ShadowHunt',()=>go('hunt')],['Leaderboard',()=>go('board')],['Anchal Zero',openFiles],['How to play',how],['Location & compass setup',()=>go('setup')],['Agent security',()=>go('secure')],...(agent.is_admin?[['HQ admin: drops & safehouses',()=>go('admin')]]:[])].map(([t,f])=>
     <button key={t} onClick={()=>{setMenu(false);f()}} className="text-left rounded-xl px-3 py-3 font-semibold text-lg hover:bg-raise">{t}</button>)}
   </nav></div>}
 </div>
}
