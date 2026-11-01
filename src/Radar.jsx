import {useEffect,useRef,useState} from 'react'
import {sb,useGeo,km,compass} from './lib'
import {GpsBar} from './ui'
import Scope from './Scope'
const ALERT_M=1000,RANGE_M=3000,DAY=864e5,EVERY=20000
const perm=()=>typeof Notification==='undefined'?'unsupported':Notification.permission
const load=()=>{try{return JSON.parse(localStorage.getItem('sh_alerted')||'{}')}catch{return{}}}
const fd=d=>d<1000?d+' m':km(d)+' km'
async function notify(title,body){
 navigator.vibrate?.([200,100,200])
 if(perm()!=='granted')return
 try{const r=await navigator.serviceWorker?.ready;if(r)return r.showNotification(title,{body,tag:'drop',icon:'/icon-192.png',badge:'/icon-192.png',renotify:true,vibrate:[200,100,200]})}catch{}
 try{new Notification(title,{body,icon:'/icon-192.png'})}catch{}
}
/* Live home radar: rescans every 20 s while the app is open. Drops show as coarse blips; other agents only as a count. */
export default function Radar({go}){
 const[pos,gpsErr,ref]=useGeo(false),[scan,setScan]=useState(),[p,setP]=useState(perm()),[toast,setToast]=useState(),busy=useRef(false)
 const ready=!!pos&&pos.acc<=150
 useEffect(()=>{if(!ready)return
  const run=async()=>{const q=ref.current;if(!q||busy.current||document.visibilityState!=='visible')return;busy.current=true
   const{data}=await sb.rpc('radar_scan',{p_lat:q.lat,p_lng:q.lng});busy.current=false;if(!data)return
   setScan({...data,at:Date.now()})
   const seen=load(),now=Date.now(),fresh=data.drops.filter(d=>d.dist<=ALERT_M&&!(seen[d.id]>now-DAY))
   if(fresh.length){const d=fresh[0];fresh.forEach(x=>seen[x.id]=now);localStorage.setItem('sh_alerted',JSON.stringify(seen))
    const msg=`Intel detected about ${fd(d.dist)} ${compass(d.brg)} of you. Run a Dead Drop to grab it.`
    setToast(msg);notify('Drop detected',msg)}}
  run();const i=setInterval(run,EVERY);document.addEventListener('visibilitychange',run)
  return()=>{clearInterval(i);document.removeEventListener('visibilitychange',run)}},[ready])
 const enable=async()=>{if(perm()==='unsupported')return;setP(await Notification.requestPermission())}
 const drops=scan?.drops||[],n=drops.length,near=drops[0]
 const range=!near?1000:near.dist<=500?1000:near.dist<=1200?2000:RANGE_M
 return <div className="rounded-md border-2 border-ink bg-ink text-paper p-4">
  <div className="flex items-center justify-between gap-2"><span className="stencil text-3xl">Radar</span><GpsBar pos={pos}/></div>
  <div className="flex justify-center my-2"><Scope range={range} size={250} blips={drops.map(d=>({...d,color:d.dist<=ALERT_M?'#FFD21F':'#E9C46A',fade:d.dist<=range?1:.6}))}/></div>
  {!pos&&gpsErr&&<p className="text-sm font-semibold text-signal">{gpsErr}</p>}
  <p className="text-lg font-semibold">{!ready?'Waiting for a good GPS fix to scan…':!scan?'Scanning…':n?<>{n} drop{n>1?'s':''} within 3 km. Nearest about <b className="text-signal">{fd(near.dist)} {compass(near.brg)}</b>.</>:'No drops within 3 km. Keep moving; the radar sweeps every 20 s.'}</p>
  {scan&&<p className="text-paper/70 font-semibold mt-1">{scan.agents?`${scan.agents} other agent${scan.agents>1?'s':''} active within 2 km`:'No other agents active nearby'}</p>}
  {toast&&<div role="status" className="mt-2 rounded bg-signal text-ink p-2 font-extrabold">{toast}</div>}
  <div className="flex gap-2 mt-3">
   {n>0&&<button onClick={()=>go('drop')} className="flex-1 rounded-md bg-signal text-ink font-extrabold py-2.5">Run Dead Drop</button>}
   {p==='default'&&<button onClick={enable} className="flex-1 rounded-md border-2 border-paper font-extrabold py-2.5">Turn on alerts</button>}
  </div>
  {p==='denied'&&<p className="text-sm text-paper/70 mt-2">Alerts are blocked. Allow notifications for this site in browser settings.</p>}
  {p==='granted'&&<p className="text-sm text-paper/70 mt-2">Alerts on: you're notified when a drop is within 1 km while Safehouse is open.</p>}
 </div>
}
