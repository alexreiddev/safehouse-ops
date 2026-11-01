import {useEffect,useState} from 'react'
import {rankOf,km,sb} from './lib'
import {Card} from './ui'
import Radar from './Radar'
const Op=({title,meta,desc,onClick,dark})=><button onClick={onClick} className={`text-left rounded-md border-2 border-ink p-4 active:translate-y-px ${dark?'bg-ink text-paper':'bg-card'}`}>
 <div className="flex items-baseline justify-between gap-2"><span className="stencil text-4xl">{title}</span><span className={`text-sm font-bold whitespace-nowrap shrink-0 ${dark?'text-signal':'text-mute'}`}>{meta}</span></div>
 <p className={`mt-1 ${dark?'text-paper/80':'text-mute'}`}>{desc}</p></button>
export default function HQ({agent,go,how}){
 const[sec,setSec]=useState();useEffect(()=>{sb.rpc('security_status').then(({data})=>setSec(data))},[])
 const r=rankOf(agent.xp),pct=r.next?Math.round((agent.xp-r.floor)/(r.next[0]-r.floor)*100):100
 return <div className="min-h-dvh flex flex-col gap-4 p-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
  <div className="flex items-center justify-between"><span className="stencil text-3xl">Safehouse</span><span className="font-bold text-mute">{agent.district}</span></div>
  <Card className="p-4">
   <div className="text-mute font-semibold">{r.name}</div>
   <div className={`stencil [overflow-wrap:anywhere] ${agent.callsign.length>10?'text-4xl':'text-5xl'}`}>{agent.callsign}</div>
   <div className="mt-3 h-3 rounded-full bg-line overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-signal border-r-2 border-ink" style={{width:pct+'%'}}/></div>
   <div className="text-sm text-mute mt-1 font-semibold">{agent.xp} XP{r.next?` · ${r.next[0]-agent.xp} to ${r.next[1]}`:' · top rank'}</div>
   <dl className="grid grid-cols-3 mt-4 border-t-2 border-ink pt-3 text-center">
    {[[km(agent.meters),'km walked'],[Math.round(agent.active_sec/60),'active min'],[agent.ops,'ops run']].map(([v,l])=><div key={l}><dd className="wide text-2xl font-black">{v}</dd><dt className="text-sm text-mute">{l}</dt></div>)}</dl>
  </Card>
  {sec&&!sec.cipher&&!sec.passkeys&&<button onClick={()=>go('secure')} className="text-left rounded-md border-2 border-alert bg-alert/10 p-3"><div className="font-extrabold text-alert">Back up your agent</div><div className="text-sm">Without a cipher or passkey, clearing the app loses your XP. Takes 30 seconds.</div></button>}
  <Radar go={go}/>
  <Op dark title="Dead Drop" meta="Solo · 10–40 min" desc="A drop is hidden near you. Follow the signal and reach it before the clock runs out." onClick={()=>go('drop')}/>
  <Op title="ShadowHunt" meta="Squad · 2–10" desc="Hunters see hiders only on timed pings. The zone shrinks. Tag them before time's up." onClick={()=>go('hunt')}/>
  <Op title="Leaderboard" meta="Weekly" desc={`Top agents in ${agent.district} this week.`} onClick={()=>go('board')}/>
  <div className="flex justify-center gap-6"><button onClick={how} className="underline font-bold text-mute py-2">How to play</button><button onClick={()=>go('secure')} className="underline font-bold text-mute py-2">Agent security</button></div>
  {agent.is_admin&&<button onClick={()=>go('admin')} className="underline font-bold text-mute py-2">HQ admin: drops & safehouses</button>}
 </div>
}
