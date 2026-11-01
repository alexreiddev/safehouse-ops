import {useEffect,useState} from 'react'
import {sb,rankOf} from './lib'
import {Screen,Pick,Err} from './ui'
export default function Board({agent,onExit}){
 const[d,setD]=useState(agent.district),[week,setWeek]=useState(true),[rows,setRows]=useState(),[err,setErr]=useState()
 useEffect(()=>{setRows();sb.rpc('leaderboard',{p_district:d==='All'?null:d,p_week:week}).then(({data,error})=>{if(error)setErr(error.message);else setRows(data)})},[d,week])
 return <Screen title="Leaderboard" kicker={week?'This week (resets Monday)':'All time'} onBack={onExit}>
  <Pick label="District" v={d} o={['Ernakulam','Idukki','All']} set={setD}/>
  <Pick label="Period" v={week} o={[true,false]} set={setWeek} fmt={x=>x?'This week':'All time'}/>
  <Err>{err}</Err>
  {!rows?<p className="text-mute font-semibold">Loading…</p>:!rows.length?<p className="text-lg">No ops logged yet. Run one and take the top spot.</p>:
  <ol className="rounded-md border-2 border-ink bg-card divide-y-2 divide-line">{rows.map((r,i)=><li key={r.callsign} className={'flex items-center gap-3 px-3 py-3 '+(r.callsign===agent.callsign?'bg-signal':'')}>
   <span className="wide font-black text-2xl w-9 text-right tabular-nums">{i+1}</span>
   <div className="flex-1 min-w-0"><div className="font-extrabold text-lg truncate">{r.callsign}</div><div className="text-sm text-mute">{rankOf(r.total_xp).name} · {r.district}</div></div>
   <span className="wide font-black text-xl tabular-nums">{r.xp}<span className="text-sm font-bold"> XP</span></span></li>)}</ol>}
 </Screen>
}
