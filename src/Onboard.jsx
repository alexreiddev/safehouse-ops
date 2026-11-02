import {useState} from 'react'
import {sb} from './lib'
import {Btn,Field,Pick,inputCls,Err} from './ui'
import {CipherReveal,Restore} from './Secure'
const RULES=['You are 18 or older.','Play only in public places, in daylight. Stay off roads, rail lines, water edges, forests, reserves and private property.','Never follow, photograph or involve people who are not playing.','Watch traffic. You are responsible for your own safety.']
export default function Onboard({onDone}){
 const[step,setStep]=useState(0),[cs,setCs]=useState(''),[dob,setDob]=useState(''),[district,setDistrict]=useState('Ernakulam'),[ok,setOk]=useState(false),[err,setErr]=useState(),[busy,setBusy]=useState(false)
 const valid=/^[A-Za-z0-9_-]{3,16}$/.test(cs)&&dob&&ok
 const submit=async e=>{e.preventDefault();setBusy(true);setErr()
  const{error}=await sb.rpc('register_agent',{p_callsign:cs,p_dob:dob,p_district:district});setBusy(false)
  if(error)return setErr(error.message);setStep(2)}
 if(step===2)return <CipherReveal onDone={onDone}/>
 if(step===3)return <Restore onDone={onDone} onBack={()=>setStep(0)}/>
 if(step===0)return <div className="min-h-dvh bg-panel text-ink flex flex-col p-6 pt-[max(3rem,env(safe-area-inset-top))]">
  <div className="flex-1 flex flex-col justify-center">
   <h1 className="stencil text-[5.5rem] text-signal">Safe&shy;house</h1>
   <p className="text-2xl font-semibold mt-6 max-w-xs leading-snug">Your city is the mission map. Run ops on foot. Don't get caught.</p>
   <p className="text-mute mt-3">Ernakulam and Idukki. 18+.</p></div>
  <Btn onClick={()=>setStep(1)}>Report for duty</Btn>
  <button onClick={()=>setStep(3)} className="mt-4 font-bold text-ink/80 underline">Already an agent? Restore</button></div>
 return <form onSubmit={submit} className="min-h-dvh flex flex-col gap-5 p-5 pt-[max(2rem,env(safe-area-inset-top))]">
  <h1 className="stencil text-5xl">Agent file</h1>
  <Field label="Callsign" hint="3–16 letters, numbers, _ or -. Other agents see this."><input className={inputCls} value={cs} onChange={e=>setCs(e.target.value)} maxLength={16} autoCapitalize="characters" placeholder="NIGHTHERON"/></Field>
  <Field label="Date of birth" hint="Used once to confirm you're 18+. We don't store it."><input type="date" className={inputCls} value={dob} onChange={e=>setDob(e.target.value)}/></Field>
  <Pick label="Home district" v={district} o={['Ernakulam','Idukki']} set={setDistrict}/>
  <div className="rounded-2xl border border-line bg-card p-4"><div className="font-bold mb-2">Rules of engagement</div>
   <ol className="list-decimal pl-5 space-y-1.5">{RULES.map(r=><li key={r}>{r}</li>)}</ol>
   <label className="flex gap-3 items-center mt-4 font-bold"><input type="checkbox" checked={ok} onChange={e=>setOk(e.target.checked)} className="size-6 accent-[#A3D67F]"/>I agree to these rules</label></div>
  <Err>{err}</Err>
  <div className="mt-auto"><Btn type="submit" disabled={!valid||busy}>{busy?'Filing…':'Create agent'}</Btn></div></form>
}
