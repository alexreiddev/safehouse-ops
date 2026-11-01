import {useCallback,useEffect,useRef,useState} from 'react'
import {sb} from '../lib'
import {rpc,bell,unlockAudio,useWatch,bearing,dir8,hm,when,meters} from './api'
import StoryAdmin from './StoryAdmin'

const CASES=[['A','The Undelivered Letter'],['B',"The Spirits' Fort"],['C','The Twentieth Camp'],['D','The Unfinished Face']]
const isOpen=()=>location.hash.startsWith('#/files')
const close=()=>{history.replaceState(null,'',location.pathname+location.search);window.dispatchEvent(new HashChangeEvent('hashchange'))}

/* ---------- small pieces ---------- */
const Btn=({v='primary',className='',...p})=><button {...p} className={`w-full rounded-md py-4 px-5 text-lg font-extrabold transition-transform disabled:opacity-40 disabled:pointer-events-none active:translate-y-px ${v==='primary'?'bg-signal text-ink border-2 border-ink':v==='dark'?'bg-ink text-paper border-2 border-ink':'bg-card text-ink border-2 border-ink'} ${className}`}/>
const Note=({tone='mute',children})=><p className={`text-sm font-semibold ${tone==='alert'?'text-alert':'text-mute'}`}>{children}</p>
const ErrLine=({e})=>e?<div className="rounded-md border-2 border-alert p-3 font-bold text-alert">{e}</div>:null
const Bars=({n=6})=><span aria-label="redacted" className="inline-block align-middle h-[0.9em] bg-ink" style={{width:`${n}ch`}}/>

function Shell({kicker,title,onBack,children,right}){
 return <div className="min-h-full flex flex-col">
  <header className="bg-ink text-paper px-4 pt-[max(.9rem,env(safe-area-inset-top))] pb-4 sticky top-0 z-10">
   <div className="flex items-center justify-between gap-3">
    <button onClick={onBack} className="font-bold text-paper/80 py-1">← {onBack===close?'Exit':'Back'}</button>
    <span className="text-xs font-bold tracking-[.2em] text-signal uppercase">Anchal Zero</span>{right||<span className="w-10"/>}
   </div>
   {kicker&&<div className="mt-3 text-xs font-bold tracking-[.18em] uppercase text-paper/60">{kicker}</div>}
   <h1 className="stencil text-4xl leading-none mt-1">{title}</h1>
  </header>
  <main className="flex-1 flex flex-col gap-4 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</main>
 </div>}

const Archive=({text})=>text?<section className="rounded-md border-2 border-ink bg-card p-4">
 <div className="text-xs font-extrabold tracking-[.18em] text-mute uppercase">Archive · real history</div>
 <p className="mt-2 text-[1.05rem] leading-relaxed">{text}</p></section>:null
const Theory=({text})=>text?<section className="rounded-md border-2 border-ink bg-ink text-paper p-4">
 <div className="flex justify-between gap-2 text-xs font-extrabold tracking-[.18em] uppercase"><span className="text-signal">Agency theory</span><span className="text-paper/60">Not history</span></div>
 <p className="mt-2 text-[1.05rem] leading-relaxed whitespace-pre-wrap font-mono">{text}</p></section>:null

/* ---------- launcher shown on HQ ---------- */
function Launcher(){
 const[show,setShow]=useState(false)
 useEffect(()=>{let ok=false,live=true
  const check=async()=>{if(!ok){const{data:{session}}=await sb.auth.getSession();if(session){const{data}=await sb.from('agents').select('id').eq('id',session.user.id).maybeSingle();ok=!!data}}
   let v='hq';try{v=localStorage.getItem('sh_view')||'hq'}catch{}
   if(live)setShow(ok&&v==='hq')}
  check();const i=setInterval(check,1500);return()=>{live=false;clearInterval(i)}},[])
 if(!show)return null
 return <button onClick={()=>{unlockAudio();location.hash='#/files'}} aria-label="Open Anchal Zero"
  className="fixed z-[900] right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] rounded-full bg-ink text-paper border-2 border-signal px-4 py-3 font-extrabold shadow-[0_4px_0_var(--color-ink)] flex items-center gap-2">
  <span className="inline-block w-2.5 h-2.5 rounded-full bg-signal animate-pulse"/>Anchal Zero</button>}

/* ---------- board ---------- */
function Board({go}){
 const[b,setB]=useState(),[e,setE]=useState(),[busy,setBusy]=useState(false)
 const load=useCallback(()=>rpc('story_board').then(x=>{setB(x);setE()}).catch(x=>setE(x.message)),[])
 useEffect(()=>{load();const i=setInterval(load,30000);return()=>clearInterval(i)},[load])
 if(!b)return <Shell title="Case board" onBack={close}>{e?<ErrLine e={e}/>:<Note>Decrypting…</Note>}</Shell>
 const silent=b.handler_silent_until&&new Date(b.handler_silent_until)>new Date()
 const byCase=k=>b.files.filter(f=>f.case===k)
 const fin=b.files.find(f=>f.case==='F')
 const checkin=async()=>{setBusy(true);try{await rpc('story_checkin');await load()}catch(x){setE(x.message)}setBusy(false)}
 return <Shell title="Case board" kicker={`Runner ${b.callsign} · Season 1`} onBack={close}>
  <div className={`rounded-md border-2 p-3 font-bold ${silent?'border-alert text-alert':'border-ink'}`}>
   {silent?<>Handler: <span className="uppercase">no signal</span>.</>:<>Postmaster: standing by.</>}
   <div className="text-sm font-semibold text-mute mt-1">{b.window?'Field hours open until 17:30.':'Field closed. Files can be read now and played from 06:00 to 17:30.'}</div>
  </div>
  {b.alerts.map((a,i)=><div key={i} role="alert" className="rounded-md bg-alert text-paper p-3 font-bold">
   {a.callsign} is overdue from {a.file||'a file'} (due {hm(a.due_at)}). Call them now. If you can't reach them, call 112.</div>)}
  {b.checkout&&<div className="rounded-md border-2 border-ink bg-card p-3 flex items-center justify-between gap-3">
   <div><div className="font-extrabold">Checked out</div><div className="text-sm text-mute font-semibold">Back by {hm(b.checkout.due_at)}. Your squad is alerted if you're late.</div></div>
   <button disabled={busy} onClick={checkin} className="shrink-0 rounded-md bg-signal border-2 border-ink px-3 py-2 font-extrabold">I'm back safe</button></div>}
  <ErrLine e={e}/>
  {CASES.map(([k,name])=><section key={k} className="rounded-md border-2 border-ink bg-card">
   <div className="px-4 pt-3 pb-2 border-b-2 border-ink"><span className="text-xs font-extrabold tracking-[.18em] text-mute">CASE {k}</span><div className="stencil text-2xl leading-tight">{name}</div></div>
   {byCase(k).map(f=><FileRow key={f.id} f={f} go={go}/>)}
  </section>)}
  {fin&&<button disabled={fin.status==='locked'} onClick={()=>go({v:'file',id:'F'})} className="rounded-md border-2 border-ink bg-ink text-paper p-4 text-left disabled:opacity-90">
   <div className="text-xs font-extrabold tracking-[.18em] text-signal">FINALE</div>
   <div className="stencil text-3xl">{fin.status==='locked'?<Bars n={12}/>:fin.title}</div>
   <div className="text-sm text-paper/70 font-semibold mt-1">{fin.status==='locked'?'Needs the last file of every case.':fin.status==='secured'?'Delivered.':'All four clues recovered. Squad of three.'}</div></button>}
  {b.admin&&<Btn v="ghost" onClick={()=>go({v:'admin'})}>HQ: place and schedule drops</Btn>}
 </Shell>}

function FileRow({f,go}){
 const locked=f.status==='locked'
 let sub
 if(locked)sub=f.release_at?`Arrives ${when(f.release_at)}`:f.collective?`Opens when ${f.collective.need} agents secure ${f.collective.of} (${f.collective.have}/${f.collective.need})`:'Locked'
 else if(f.status==='secured')sub='Secured'
 else if(!f.live)sub=f.frozen?'Frozen by HQ':'Not in the field yet'
 else sub=f.place
 const warn=f.status==='new'&&(f.lost>0?`${f.lost} line${f.lost>1?'s':''} already lost. Open it now.`:f.decay_in_h!=null&&f.decay_in_h<=6?`Unread. Starts decaying in ${Math.max(0,f.decay_in_h)} h.`:null)
 return <button disabled={locked} onClick={()=>go({v:'file',id:f.id})} className="w-full text-left px-4 py-3 border-b border-line last:border-b-0 flex gap-3 items-start disabled:opacity-70">
  <span className="font-extrabold w-7 shrink-0">{f.id}</span>
  <span className="flex-1 min-w-0"><span className="block font-extrabold text-lg leading-tight">{locked?<Bars n={10}/>:f.title}{f.squad&&!locked&&<span className="ml-2 text-xs font-bold align-middle border border-ink rounded px-1">SQUAD</span>}</span>
   <span className="block text-sm text-mute font-semibold">{sub}</span>{warn&&<span className="block text-sm font-bold text-alert">{warn}</span>}</span>
  <span className={`text-xs font-extrabold shrink-0 mt-1 ${f.status==='new'?'text-alert':''}`}>{{locked:'',new:'NEW',open:'OPEN',secured:'✓'}[f.status]}</span>
 </button>}

/* ---------- a file ---------- */
function FileView({id,go}){
 const[f,setF]=useState(),[e,setE]=useState()
 useEffect(()=>{rpc('story_open',{p_file:id}).then(setF).catch(x=>setE(x.message))},[id])
 if(!f)return <Shell title={`File ${id}`} onBack={()=>go({v:'board'})}>{e?<ErrLine e={e}/>:<Note>Opening file…</Note>}</Shell>
 const fin=id==='F'
 return <Shell kicker={fin?'Finale':`Case ${f.case} · File ${f.id}`} title={f.title} onBack={()=>go({v:'board'})}>
  <Note>{f.place}{f.squad?' · squad of three':''}</Note>
  <section className="rounded-md border-2 border-ink bg-card p-4">
   <div className="text-xs font-extrabold tracking-[.18em] text-mute uppercase">Briefing{f.lost>0?` · ${f.lost} line${f.lost>1?'s':''} lost to decay`:''}</div>
   <p className="mt-2 text-xl font-bold leading-snug whitespace-pre-wrap">{f.briefing}</p>
  </section>
  {f.secured?<><Reveal r={f.reveal} fin={fin} quiet/><Btn v="ghost" onClick={()=>go({v:'board'})}>Back to the board</Btn></>
   :!f.live?<Note tone="alert">{f.frozen?'HQ has frozen this drop. Stand down until it reopens.':'HQ hasn’t placed this drop in the field yet. Read it, then wait for word.'}</Note>
   :<><Note>Get within {f.radius} m. When you arrive you'll hold position for {f.hold_sec>=60?`${Math.round(f.hold_sec/60)} minutes`:'a moment'}, phone face-down.</Note>
    <Btn onClick={()=>{unlockAudio();go({v:'run',file:f})}}>Move out</Btn></>}
 </Shell>}

/* ---------- moving to the drop ---------- */
function Run({file,go}){
 const[pos,gErr,ref]=useWatch(),[st,setSt]=useState(),[e,setE]=useState(),[busy,setBusy]=useState(false),[co,setCo]=useState(),rang=useRef(false)
 useEffect(()=>{let live=true
  const f=async()=>{const p=ref.current;if(!p)return
   try{const d=await rpc('story_ping',{p_file:file.id,p_lat:p.lat,p_lng:p.lng});if(!live)return;setSt(d)
    if(d.bell&&!rang.current){rang.current=true;bell()}if(!d.bell)rang.current=false}catch(x){live&&setE(x.message)}}
  f();const i=setInterval(f,5000);return()=>{live=false;clearInterval(i)}},[file.id,!!pos])
 const begin=async()=>{setBusy(true);setE();try{const p=ref.current;const h=await rpc('story_hold_start',{p_file:file.id,p_lat:p.lat,p_lng:p.lng});go({v:'hold',file,hold:h,started:Date.now()})}catch(x){setE(x.message)}setBusy(false)}
 const checkout=async m=>{setBusy(true);setE();try{const p=ref.current;setCo(await rpc('story_checkout',{p_file:file.id,p_minutes:m,p_lat:p.lat,p_lng:p.lng}))}catch(x){setE(x.message)}setBusy(false)}
 const dir=pos&&file.lat!=null?dir8(bearing(pos.lat,pos.lng,file.lat,file.lng)):null
 const maps=`https://www.google.com/maps/dir/?api=1&destination=${file.lat},${file.lng}&travelmode=driving`
 const near=st?.near,needCo=file.squad&&!st?.checkout&&!co
 return <Shell kicker={`File ${file.id} · in the field`} title={near?'You’re here.':meters(st?.dist)} onBack={()=>go({v:'file',id:file.id})}>
  {gErr&&<Note tone="alert">{gErr}</Note>}
  {!near&&<><div className="rounded-md border-2 border-ink bg-card p-4">
    <div className="text-xs font-extrabold tracking-[.18em] text-mute uppercase">Heading</div>
    <div className="stencil text-3xl">{dir?`Go ${dir}`:'Finding you…'}</div>
    <div className="text-sm font-semibold text-mute mt-1">{st?.bell?'The bell has rung. You are close.':'A bell rings when you are within 200 m.'}</div></div>
   <a href={maps} target="_blank" rel="noreferrer" className="block text-center rounded-md border-2 border-ink bg-card py-4 font-extrabold text-lg">Route in Maps</a>
   <Note>Travel safely. Never read this screen while driving or riding. Stay off the road edge and back from water.</Note></>}
  {near&&<>
   {st.archivist&&<section className="rounded-md border-2 border-dashed border-alert p-4">
    <div className="text-xs font-extrabold tracking-[.18em] text-alert uppercase">Intercepted note</div>
    <p className="mt-2 text-xl font-bold font-mono whitespace-pre-wrap">{st.archivist}</p></section>}
   {file.squad&&<div className="rounded-md border-2 border-ink bg-card p-3 font-bold">Squad within 100 m: {Math.min(st.squad_near,2)} of 2{st.squad_near<2&&<div className="text-sm font-semibold text-mute">Your two squadmates must be here with Safehouse open.</div>}</div>}
   {needCo&&<section className="rounded-md border-2 border-ink bg-card p-4">
    <div className="font-extrabold text-lg">Check out first</div>
    <Note>When will you be back somewhere safe? If you don't tap "I'm back safe" by then, your squad is alerted.</Note>
    <div className="grid grid-cols-4 gap-2 mt-3">{[60,120,180,240].map(m=><button key={m} disabled={busy} onClick={()=>checkout(m)} className="rounded-md border-2 border-ink py-2 font-extrabold">{m/60} h</button>)}</div></section>}
   {co&&<Note>Checked out. Back by {hm(co.due_at)}{co.squad.length?`. Squad: ${co.squad.join(', ')}`:''}.</Note>}
   {!st.window&&<Note tone="alert">Field hours are 06:00 to 17:30.</Note>}
   <Btn disabled={busy||!st.window||(file.squad&&(st.squad_near<2||needCo))} onClick={begin}>{file.hold_sec>0?'Begin the hold':'Secure the file'}</Btn></>}
  <ErrLine e={e}/>
 </Shell>}

/* ---------- the hold ---------- */
function Hold({file,hold,started,go}){
 const[,,ref]=useWatch(),[left,setLeft]=useState(hold.hold_sec),[e,setE]=useState(),[busy,setBusy]=useState(false),done=useRef(false)
 const finish=useCallback(async()=>{if(done.current)return;setBusy(true);setE()
  try{const p=ref.current||{lat:file.lat,lng:file.lng};const r=await rpc('story_hold_done',{p_file:file.id,p_lat:p.lat,p_lng:p.lng});done.current=true;go({v:'reveal',file,r})}catch(x){setE(x.message)}setBusy(false)},[file,go,ref])
 useEffect(()=>{const t=()=>{const l=Math.max(0,hold.hold_sec-Math.floor((Date.now()-started)/1000));setLeft(l);if(l===0&&!done.current){bell();setTimeout(finish,600)}}
  t();const i=setInterval(t,1000);document.addEventListener('visibilitychange',t);return()=>{clearInterval(i);document.removeEventListener('visibilitychange',t)}},[hold.hold_sec,started,finish])
 const fin=file.id==='F'
 return <div className="min-h-full bg-ink text-paper flex flex-col items-center justify-center p-6 text-center gap-6">
  <div className="text-xs font-extrabold tracking-[.2em] text-signal uppercase">Hold position</div>
  <p className="stencil text-4xl leading-tight max-w-md">{hold.hold_prompt||'Wait.'}</p>
  {!fin&&<div className="stencil text-6xl tabular-nums">{Math.floor(left/60)}:{String(left%60).padStart(2,'0')}</div>}
  <p className="text-paper/70 font-semibold max-w-sm">{fin?'Phones face-down. All of you. The bell will ring.':'Put the phone face-down. Look up. The bell rings when it’s time.'}</p>
  {e&&<p className="font-bold text-alert">{e}</p>}
  {left===0&&<button disabled={busy} onClick={finish} className="rounded-md bg-signal text-ink border-2 border-paper px-6 py-3 font-extrabold">{busy?'Decrypting…':'Open the file'}</button>}
 </div>}

/* ---------- the reveal ---------- */
function Reveal({r,fin,quiet}){
 if(!r)return null
 if(fin&&!quiet)return <div className="flex flex-col gap-4">
  <section className="rounded-md border-2 border-ink bg-card p-5 shadow-[0_6px_0_var(--color-ink)]">
   <div className="text-xs font-extrabold tracking-[.18em] text-mute uppercase">The letter, July 1924 · Agency theory, not history</div>
   <p className="mt-3 text-xl leading-relaxed whitespace-pre-wrap font-mono">{r.theory}</p></section>
  <p className="stencil text-3xl leading-tight whitespace-pre-wrap">{r.cliffhanger}</p>
  <Archive text={r.archive}/>
  {r.xp>0&&<Note>+{r.xp} XP</Note>}<Note>{r.unlock_line}</Note></div>
 return <div className="flex flex-col gap-4">
  <Archive text={r.archive}/><Theory text={r.theory}/>
  <p className="stencil text-3xl leading-tight whitespace-pre-wrap">{r.cliffhanger}</p>
  {!quiet&&r.xp>0&&<div className="font-extrabold">+{r.xp} XP</div>}
  {r.unlock_line&&<Note>{r.unlock_line}</Note>}</div>}

function RevealScreen({file,r,go}){
 const fin=file.id==='F',[stage,setStage]=useState(fin?0:2)
 useEffect(()=>{if(!fin)return;const a=setTimeout(()=>{bell();setStage(1)},2500),b=setTimeout(()=>setStage(2),5000);return()=>{clearTimeout(a);clearTimeout(b)}},[fin])
 if(stage<2)return <div className="min-h-full bg-ink text-paper flex items-center justify-center p-6"><p className="stencil text-5xl">{stage===0?'Wait.':'…'}</p></div>
 return <Shell kicker={fin?'Delivered':`File ${file.id} · secured`} title={file.title} onBack={()=>go({v:'board'})}>
  <Reveal r={r} fin={fin}/><Btn onClick={()=>go({v:'board'})}>Back to the board</Btn></Shell>}

/* ---------- root ---------- */
export default function Story(){
 const[open,setOpen]=useState(isOpen),[nav,setNav]=useState({v:'board'})
 useEffect(()=>{const h=()=>{setOpen(isOpen());if(!isOpen())setNav({v:'board'})};window.addEventListener('hashchange',h);return()=>window.removeEventListener('hashchange',h)},[])
 useEffect(()=>{document.body.style.overflow=open?'hidden':'';return()=>{document.body.style.overflow=''}},[open])
 const go=useCallback(n=>{setNav(n);document.getElementById('story-scroll')?.scrollTo(0,0)},[])
 if(!open)return <Launcher/>
 let view
 if(nav.v==='file')view=<FileView id={nav.id} go={go}/>
 else if(nav.v==='run')view=<Run file={nav.file} go={go}/>
 else if(nav.v==='hold')view=<Hold file={nav.file} hold={nav.hold} started={nav.started} go={go}/>
 else if(nav.v==='reveal')view=<RevealScreen file={nav.file} r={nav.r} go={go}/>
 else if(nav.v==='admin')view=<StoryAdmin onBack={()=>go({v:'board'})} Shell={Shell}/>
 else view=<Board go={go}/>
 return <div id="story-scroll" className="fixed inset-0 z-[1000] overflow-y-auto bg-paper text-ink">{view}</div>}
