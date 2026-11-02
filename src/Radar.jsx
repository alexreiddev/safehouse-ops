import {useEffect,useRef,useState} from 'react'
import {sb,useGeo,km,compass} from './lib'
import {GpsBar,Hz} from './ui'
import {Box,Bell} from './icons'
import Scope from './Scope'
const ALERT_M=1000,RANGE_M=3000,DAY=864e5,EVERY=20000
const perm=()=>typeof Notification==='undefined'?'unsupported':Notification.permission
const load=()=>{try{return JSON.parse(localStorage.getItem('sh_alerted')||'{}')}catch{return{}}}
export const fd=d=>d<1000?d+' m':km(d)+' km'
const ARROW=['↑','↗','→','↘','↓','↙','←','↖']
export const arrow=b=>ARROW[Math.round((((b%360)+360)%360)/45)%8]
/* the drop the agent picked on the radar; Dead Drop runs to it */
export const getPick=()=>{try{return localStorage.getItem('sh_pick')}catch{return null}}
export const setPick=id=>{try{id?localStorage.setItem('sh_pick',id):localStorage.removeItem('sh_pick')}catch{}}
async function notify(title,body){
 navigator.vibrate?.([200,100,200])
 if(perm()!=='granted')return
 try{const r=await navigator.serviceWorker?.ready;if(r)return r.showNotification(title,{body,tag:'drop',icon:'/icon-192.png',badge:'/icon-192.png',renotify:true,vibrate:[200,100,200]})}catch{}
 try{new Notification(title,{body,icon:'/icon-192.png'})}catch{}
}
/* Home radar: rescans every 20 s while the app is open. Drops show as coarse blips (tap one to pick it); other agents only as a count.
   The scope only redraws when a scan result arrives. */
export default function Radar({go}){
 const[pos,gpsErr,ref]=useGeo(false),[scan,setScan]=useState(),[p,setP]=useState(perm()),[toast,setToast]=useState(),[pick,setPk]=useState(getPick),busy=useRef(false)
 const ready=!!pos&&pos.acc<=150
 useEffect(()=>{if(!ready)return
  const run=async()=>{const q=ref.current;if(!q||busy.current||document.visibilityState!=='visible')return;busy.current=true
   const{data}=await sb.rpc('radar_scan',{p_lat:q.lat,p_lng:q.lng});busy.current=false;if(!data)return
   setScan(data)
   const seen=load(),now=Date.now(),fresh=data.drops.filter(d=>d.dist<=ALERT_M&&!(seen[d.id]>now-DAY))
   if(fresh.length){const d=fresh[0];fresh.forEach(x=>seen[x.id]=now);localStorage.setItem('sh_alerted',JSON.stringify(seen))
    const msg=`Intel detected about ${fd(d.dist)} ${compass(d.brg)} of you. Run a Dead Drop to grab it.`
    setToast(msg);notify('Drop detected',msg)}}
  run();const i=setInterval(run,EVERY);document.addEventListener('visibilitychange',run)
  return()=>{clearInterval(i);document.removeEventListener('visibilitychange',run)}},[ready])
 const enable=async()=>{if(perm()==='unsupported')return;setP(await Notification.requestPermission())}
 const drops=scan?.drops||[],n=drops.length
 const sel=drops.find(d=>d.id===pick),focus=sel||drops[0]
 const choose=id=>{const v=id===pick?null:id;setPk(v);setPick(v)}
 const range=!focus?1000:Math.max(...drops.map(d=>d.dist),focus.dist)<=800?1000:Math.max(...drops.map(d=>d.dist))<=1800?2000:RANGE_M
 return <section className="rounded-2xl border border-line bg-card p-4" aria-label="Radar">
  <div className="flex items-center justify-between gap-2"><h2 className="stencil text-3xl flex items-center">Radar<Hz/></h2><GpsBar pos={pos} detail={false}/></div>
  <div className="flex items-center gap-3 mt-2">
   <Scope range={range} size={190} className="shrink-0" onPick={choose}
    blips={drops.map(d=>({...d,color:d.id===pick?'#E9B949':'#A3D67F',selected:d.id===pick,fade:d.dist<=range?1:.55}))}/>
   <div className="min-w-0 flex-1 flex flex-col gap-3">
    {!ready?<p className="font-semibold text-mute">{!pos&&gpsErr?gpsErr:'Waiting for a good GPS fix to scan…'}</p>
     :!scan?<p className="font-semibold text-mute">Scanning…</p>
     :n?<><div><div className="wide text-3xl leading-none"><span className="text-signal">{n}</span> drop{n>1?'s':''}</div><div className="text-mute">within 3 km</div></div>
      <div className="border-t border-line pt-3"><div className="text-mute">{sel?'Selected drop':'Nearest about'}</div>
       <div className="wide text-2xl text-amber">{fd(focus.dist)} {compass(focus.brg)} <span aria-hidden="true">{arrow(focus.brg)}</span></div></div></>
     :<p className="font-semibold">No drops within 3 km. Keep moving; the radar rescans every 20 s.</p>}
    {scan&&<p className="text-mute border-t border-line pt-3">{scan.agents?`${scan.agents} other agent${scan.agents>1?'s':''} active within 2 km`:'No other agents active nearby'}</p>}
   </div></div>
  {n>1&&<div className="mt-3"><div className="text-sm text-mute mb-1.5">Tap a blip or pick a drop</div>
   <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">{drops.map((d,i)=><button key={d.id} onClick={()=>choose(d.id)} aria-pressed={d.id===pick}
    className={'shrink-0 rounded-lg border px-3 py-1.5 wide text-base '+(d.id===pick?'border-amber bg-amber/15 text-ink':'border-line text-ink/90')}>{i===0&&d.id!==pick?'Nearest · ':''}{fd(d.dist)} {compass(d.brg)}</button>)}</div></div>}
  {toast&&<div role="status" className="mt-3 rounded-xl bg-signal/15 border border-signal/60 text-ink p-2.5 font-semibold">{toast}</div>}
  <div className="flex gap-2 mt-3">
   {n>0&&<button onClick={()=>{setPick(sel?.id||drops[0].id);go('drop')}} className="flex-1 rounded-xl bg-signal text-onsig wide text-lg py-3 inline-flex items-center justify-center gap-2"><Box className="size-5"/>Run Dead Drop</button>}
   {p==='default'&&<button onClick={enable} className="flex-1 rounded-xl border border-line wide text-lg py-3 inline-flex items-center justify-center gap-2"><Bell className="size-5"/>Turn on alerts</button>}
  </div>
  {p==='denied'&&<p className="text-sm text-mute mt-2">Alerts are blocked. Allow notifications for this site in browser settings.</p>}
  {p==='granted'&&<p className="text-sm text-mute mt-2">Alerts on: you're notified when a drop is within 1 km while Safehouse is open.</p>}
 </section>
}
