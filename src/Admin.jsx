import {useEffect,useState} from 'react'
import {sb} from './lib'
import {Screen,Btn,Field,Pick,inputCls,Err} from './ui'
import OpsMap from './OpsMap'

const DISTRICTS=['Ernakulam','Idukki']
const KINDS={drops:'Drops',safehouses:'Safehouses'}
const num=(v,d)=>{const n=Number(v);return Number.isFinite(n)?n:d}
const blank=kind=>kind==='drops'?{name:'',hint:'',district:'Ernakulam'}:{name:'',district:'Ernakulam',truce_min:'2',radius:'25'}
const toForm=(kind,d)=>kind==='drops'?{name:d.name||'',hint:d.hint||'',district:d.district||'Ernakulam'}
 :{name:d.name||'',district:d.district||'Ernakulam',truce_min:String((d.truce_sec||120)/60),radius:String(d.radius||25)}

function Fields({kind,f,set}){
 const s=k=>e=>set({...f,[k]:e.target.value})
 return <>
  <Field label={kind==='drops'?'Spot name (only admins see this)':'Safehouse name (players see this)'}><input className={inputCls} value={f.name} onChange={s('name')}/></Field>
  {kind==='drops'
   ?<Field label="Hint shown within 200 m"><input className={inputCls} value={f.hint} onChange={s('hint')} placeholder="Look for the old banyan by the gate"/></Field>
   :<div className="grid grid-cols-2 gap-3">
     <Field label="Truce (minutes)" hint="Harder to reach, longer truce."><input className={inputCls} inputMode="decimal" value={f.truce_min} onChange={s('truce_min')}/></Field>
     <Field label="Radius (m)" hint="How close counts as inside."><input className={inputCls} inputMode="numeric" value={f.radius} onChange={s('radius')}/></Field></div>}
  <Pick label="District" v={f.district} o={DISTRICTS} set={v=>set({...f,district:v})}/>
 </>}

export default function Admin({onExit}){
 const[kind,setKindRaw]=useState('drops'),[rows,setRows]=useState([]),[err,setErr]=useState(),[busy,setBusy]=useState(false)
 const[pt,setPt]=useState(),[form,setForm]=useState(blank('drops'))       // new item
 const[sel,setSel]=useState(),[edit,setEdit]=useState(),[move,setMove]=useState()   // editing an existing item
 const drops=kind==='drops'
 // Reset everything in the same render as the tab switch, so the other tab's rows are never drawn as this kind.
 const setKind=k=>{if(k===kind)return;setRows([]);setPt();setSel();setEdit();setMove();setErr();setForm(blank(k));setKindRaw(k)}
 const load=()=>(kind==='safehouses'?sb.from(kind).select().is('lobby_id',null):sb.from(kind).select()).order('created_at',{ascending:false}).then(({data,error})=>error?setErr(error.message):setRows(data||[]))
 useEffect(()=>{load()},[kind])

 const payload=f=>{const base={name:f.name.trim(),district:f.district}
  if(drops)return{...base,hint:f.hint.trim()||null}
  const truce=Math.round(num(f.truce_min,2)*60),radius=Math.round(num(f.radius,25))
  if(truce<30||truce>1800)throw new Error('Truce must be between 0.5 and 30 minutes.')
  if(radius<5||radius>200)throw new Error('Radius must be between 5 and 200 m.')
  return{...base,truce_sec:truce,radius}}
 const run=async fn=>{setBusy(true);setErr();try{await fn()}catch(e){setErr(e.message)}setBusy(false)}

 const add=()=>run(async()=>{const{error}=await sb.from(kind).insert({...payload(form),lat:pt.lat,lng:pt.lng,active:false});if(error)throw error
  setPt();setForm(blank(kind));await load()})
 const open=d=>{if(sel===d.id){setSel();setEdit();setMove();return}setPt();setSel(d.id);setEdit(toForm(kind,d));setMove()}
 const save=d=>run(async()=>{const patch={...payload(edit),...(move?{lat:move.lat,lng:move.lng}:{})}
  const{error}=await sb.from(kind).update(patch).eq('id',d.id);if(error)throw error;setMove();await load()})
 const toggle=d=>run(async()=>{const{error}=await sb.from(kind).update({active:!d.active}).eq('id',d.id);if(error)throw error;await load()})
 const remove=d=>{if(!confirm(`Delete "${d.name}" for good?`))return
  run(async()=>{const{error}=await sb.from(kind).delete().eq('id',d.id);if(error)throw error;setSel();setEdit();setMove();await load()})}
 const here=()=>new Promise((ok,no)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>ok({lat:p.coords.latitude,lng:p.coords.longitude}),no,{enableHighAccuracy:true,timeout:20000}):no(new Error('No GPS on this device.')))
 const useMine=()=>run(async()=>{const p=await here();sel?setMove(p):setPt(p)})
 const pick=(lat,lng)=>sel?setMove({lat,lng}):setPt({lat,lng})

 const selRow=rows.find(r=>r.id===sel)
 const center=move||pt||selRow||rows[0]||{lat:9.9816,lng:76.2999}
 const col=d=>d.id===sel?'#E9B949':drops?(d.active?'#A3D67F':'#8a958c'):(d.active?'#7FC8BB':'#8a958c')
 const shown=rows.map(d=>d.id===sel&&move?{...d,...move}:d).filter(d=>Number.isFinite(d.lat)&&Number.isFinite(d.lng))
 const circles=drops?[]:shown.filter(d=>Number.isFinite(Number(d.radius))&&Number(d.radius)>0).map(d=>({lat:d.lat,lng:d.lng,r:Number(d.radius),color:col(d),fill:col(d)}))
 const pins=[...shown.map(d=>({lat:d.lat,lng:d.lng,color:col(d),...(d.id===sel?{label:move?'New spot':'Editing'}:{})})),...(pt?[{lat:pt.lat,lng:pt.lng,color:'#E9B949',label:'New'}]:[])]

 return <Screen title={KINDS[kind]} kicker="HQ admin" onBack={onExit}>
  <Pick label="Manage" v={kind} o={Object.keys(KINDS)} set={setKind} fmt={x=>KINDS[x]}/>
  <p>{drops?'Drops are hidden intel for Dead Drop. Their location stays secret from players.':'Safehouses are truce spots in ShadowHunt. A shadow who reaches one inside the zone can\'t be tagged or pinged for the truce time. Each works once per shadow per game. Players see them on the map.'} {sel?'Tap the map to move the one you\'re editing.':'Tap the map to place a new one, or tap a row below to edit it.'} New ones start inactive: visit the spot, confirm it's public, open and safe, then activate it.</p>
  <div className="relative h-72 rounded-2xl border border-line overflow-hidden"><OpsMap key={kind} center={center} zoom={14} onPick={pick} circles={circles} pins={pins}/></div>
  <button disabled={busy} onClick={useMine} className="rounded-2xl border border-line bg-card py-3 font-bold">{sel?'Move it to where I\'m standing':'Place one where I\'m standing'}</button>

  {pt&&!sel&&<div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
   <div className="font-bold">New {drops?'drop':'safehouse'} · {pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}</div>
   <Fields kind={kind} f={form} set={setForm}/>
   <Btn disabled={busy||!form.name.trim()} onClick={add}>{drops?'Add drop':'Add safehouse'}</Btn>
   <Btn v="ghost" onClick={()=>setPt()}>Cancel</Btn></div>}

  <Err>{err}</Err>

  <ul className="rounded-2xl border border-line bg-card divide-y-2 divide-line">{rows.length===0&&<li className="p-3 text-mute">None yet.</li>}
   {rows.map(d=><li key={d.id}>
    <div className="flex items-center gap-3 p-3">
     <button onClick={()=>open(d)} className="flex-1 min-w-0 text-left">
      <div className="font-bold truncate">{d.name}</div>
      <div className="text-sm text-mute">{d.district}{!drops&&` · truce ${num(d.truce_sec,0)/60} min · ${num(d.radius,0)} m`} · {num(d.lat,0).toFixed(5)}, {num(d.lng,0).toFixed(5)}</div>
      <div className="text-sm font-bold">{sel===d.id?'Close editor':'Edit'}</div></button>
     <button disabled={busy} onClick={()=>toggle(d)} className={'rounded-xl border-2 px-3 py-1.5 font-bold '+(d.active?'bg-panel text-ink border-line':'border-line')}>{d.active?'Active':'Inactive'}</button></div>
    {sel===d.id&&edit&&<div className="flex flex-col gap-3 px-3 pb-4">
     <Fields kind={kind} f={edit} set={setEdit}/>
     <div className="text-sm font-semibold">{move?`Moving to ${move.lat.toFixed(5)}, ${move.lng.toFixed(5)}. Save to confirm.`:'To move it, tap the map or use your location.'}</div>
     <Btn disabled={busy||!edit.name.trim()} onClick={()=>save(d)}>Save changes</Btn>
     {move&&<Btn v="ghost" onClick={()=>setMove()}>Undo move</Btn>}
     <Btn v="danger" disabled={busy} onClick={()=>remove(d)}>Delete</Btn></div>}
   </li>)}</ul>
 </Screen>}
