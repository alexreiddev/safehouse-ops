import {Component,useEffect,useState} from 'react'
import {sb,uid} from './lib'
import Onboard from './Onboard'
import HQ from './HQ'
import DeadDrop from './DeadDrop'
import Hunt from './Hunt'
import Board from './Board'
import Admin from './Admin'
import {SecureScreen} from './Secure'
import {Err} from './ui'
import Guide,{TOUR,seen,mark} from './Tour'

/* Any render crash shows a recovery screen instead of a blank page. */
export class Guard extends Component{state={e:null};static getDerivedStateFromError(e){return{e}}
 componentDidCatch(e){console.error(e)}
 render(){return this.state.e?<div className="min-h-dvh p-6 pt-16 flex flex-col gap-4"><h1 className="stencil text-5xl">Signal lost</h1><p className="text-lg">Something broke on this screen. Your progress is saved on the server.</p>
  <button onClick={()=>{try{localStorage.removeItem('sh_view')}catch{};location.reload()}} className="rounded-md bg-signal border-2 border-ink py-4 text-xl font-extrabold">Back to HQ</button></div>:this.props.children}}

export default function App(){
 const[agent,setAgent]=useState(),[err,setErr]=useState()
 const[view,setView]=useState(()=>localStorage.getItem('sh_view')||'hq')
 const[wait,setWait]=useState()
 const load=async()=>{setErr();try{const id=await uid(s=>setWait(s));setWait();const{data,error}=await sb.from('agents').select().eq('id',id).maybeSingle();if(error)throw error;setAgent(data||null)}catch(e){setErr(e.message)}}
 useEffect(()=>{load()},[])
 const[tour,setTour]=useState(false)
 useEffect(()=>{if(agent&&!seen('sh_tour'))setTour(true)},[agent])
 const go=v=>{localStorage.setItem('sh_view',v);setView(v);if(v==='hq')load()}
 if(err)return <div className="p-6 pt-16"><h1 className="stencil text-5xl mb-4">No signal</h1><Err>Couldn't reach HQ: {err}</Err><button onClick={()=>{setAgent(undefined);load()}} className="mt-4 w-full rounded-md bg-signal border-2 border-ink py-4 text-xl font-extrabold">Try again</button></div>
 if(agent===undefined)return <div className="min-h-dvh grid place-items-center"><div className="text-center"><div className="stencil text-4xl animate-pulse">Safehouse</div>{wait&&<p className="mt-3 font-semibold text-mute">Lots of agents checking in. Retrying in {wait}s…</p>}</div></div>
 if(!agent)return <Onboard onDone={load}/>
 if(view==='drop')return <DeadDrop agent={agent} onExit={()=>go('hq')}/>
 if(view==='hunt')return <Hunt agent={agent} onExit={()=>go('hq')}/>
 if(view==='board')return <Board agent={agent} onExit={()=>go('hq')}/>
 if(view==='secure')return <SecureScreen onExit={()=>go('hq')}/>
 if(view==='admin'&&agent.is_admin)return <Admin onExit={()=>go('hq')}/>
 return <>{tour&&<Guide slides={TOUR} label="Start playing" onDone={()=>{mark('sh_tour');setTour(false)}}/>}<HQ agent={agent} go={go} how={()=>setTour(true)}/></>
}
