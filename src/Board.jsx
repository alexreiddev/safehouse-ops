import {useEffect,useState} from 'react'
import {sb,rankOf} from './lib'
import {Screen,Pick,Err} from './ui'
import {Pin,Layers,Cal,Inf,Hood,Laurel} from './icons'
const MEDAL=['#E9B949','#C9CFD3','#E08A4B']
export default function Board({agent,onExit}){
 const[d,setD]=useState(agent.district),[week,setWeek]=useState(true),[rows,setRows]=useState(),[err,setErr]=useState()
 useEffect(()=>{setRows();sb.rpc('leaderboard',{p_district:d==='All'?null:d,p_week:week}).then(({data,error})=>{if(error)setErr(error.message);else setRows(data)})},[d,week])
 return <Screen title="Leaderboard" kicker={week?'This week · resets Monday':'All time'} onBack={onExit}>
  <Pick label="District" v={d} o={[['Ernakulam','Ernakulam',Pin],['Idukki','Idukki',Pin],['All','All',Layers]]} set={setD}/>
  <Pick label="Period" v={week} o={[[true,'This week',Cal],[false,'All time',Inf]]} set={setWeek}/>
  <Err>{err}</Err>
  {!rows?<p className="text-mute font-semibold">Loading…</p>:!rows.length?<p className="text-lg">No ops logged yet. Run one and take the top spot.</p>:
  <ol className="flex flex-col gap-2.5">{rows.map((r,i)=>{const me=r.callsign===agent.callsign
   return <li key={r.callsign} className={'flex items-center gap-3 rounded-2xl border px-3 py-2.5 '+(me?'border-amber bg-amber/10':'border-line bg-card')}>
    <span className="w-11 shrink-0 grid place-items-center">{i<3?<Laurel n={i+1} color={MEDAL[i]}/>:<span className="wide text-2xl">{i+1}</span>}</span>
    <span className={'size-11 shrink-0 rounded-full grid place-items-center border '+(me?'border-signal text-signal':'border-line text-mute')}><Hood className="size-7"/></span>
    <div className="flex-1 min-w-0"><div className="stencil text-2xl truncate">{r.callsign}</div><div className="text-sm text-mute">{rankOf(r.total_xp).name} · {r.district}</div></div>
    <span className="wide text-2xl tabular-nums">{r.xp} XP</span></li>})}</ol>}
 </Screen>
}
