import {createClient} from '@supabase/supabase-js'
import {useEffect,useRef,useState} from 'react'
export const sb=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY)
export const uid=async(onWait)=>{let{data:{session}}=await sb.auth.getSession()
 for(let i=0;!session;i++){const r=await sb.auth.signInAnonymously()
  if(!r.error){session=r.data.session;break}
  if(i>=5)throw r.error
  const ms=Math.min(30000,2000*2**i)+Math.random()*1500;onWait?.(Math.round(ms/1000));await new Promise(f=>setTimeout(f,ms))}
 return session.user.id}
export const dist=(a,b,c,d)=>{const r=Math.PI/180,x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;return 12742000*Math.asin(Math.sqrt(x))}
export const fmt=s=>{s=Math.max(0,Math.ceil(s));const h=s/3600|0,m=(s%3600)/60|0,x=s%60;return(h?h+':':'')+String(m).padStart(h?2:1,'0')+':'+String(x).padStart(2,'0')}
export const km=m=>(m/1000).toFixed(m<10000?2:1)
export const code4=()=>{const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:4},()=>c[Math.random()*c.length|0]).join('')}
export const RANKS=[[0,'Recruit'],[500,'Operative'],[1500,'Specialist'],[4000,'Handler'],[10000,'Ghost']]
export const rankOf=xp=>{let i=0;while(i+1<RANKS.length&&xp>=RANKS[i+1][0])i++;return{name:RANKS[i][1],floor:RANKS[i][0],next:RANKS[i+1]}}
export const compass=b=>['N','NE','E','SE','S','SW','W','NW'][Math.round((((b%360)+360)%360)/45)%8]
export const share=t=>navigator.share?navigator.share({text:t}).catch(()=>{}):navigator.clipboard?.writeText(t)

/* live GPS + screen wake lock while a mission screen is open.
   pos also carries course (deg, from GPS, only while moving) and speed (m/s). */
export function useGeo(keepAwake=true){
 const[pos,setPos]=useState(),[err,setErr]=useState(),ref=useRef()
 useEffect(()=>{let wl
  const w=navigator.geolocation.watchPosition(g=>{const c=g.coords,p={lat:c.latitude,lng:c.longitude,acc:c.accuracy,speed:c.speed,course:c.heading!=null&&!Number.isNaN(c.heading)&&(c.speed??0)>0.8?c.heading:null};ref.current=p;setPos(p);setErr()},
   e=>setErr(e.code===1?'Location is blocked for this site. Open Location & compass setup from the menu to fix it.':'Waiting for a GPS fix. Step into the open.'),
   {enableHighAccuracy:true,maximumAge:0,timeout:20000})
  const lock=()=>{if(document.visibilityState==='visible')navigator.wakeLock?.request('screen').then(x=>wl=x).catch(()=>{})}
  if(keepAwake){lock();document.addEventListener('visibilitychange',lock)}
  return()=>{navigator.geolocation.clearWatch(w);wl?.release();document.removeEventListener('visibilitychange',lock)}},[])
 return[pos,err,ref]
}
export function useNow(ms=1000){const[n,setN]=useState(Date.now());useEffect(()=>{const i=setInterval(()=>setN(Date.now()),ms);return()=>clearInterval(i)},[ms]);return n}

/* ---------- compass (DeviceOrientation API) ---------- */
export const platform=()=>{const u=navigator.userAgent||'',ios=/iPad|iPhone|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1)
 return{ios,android:/Android/i.test(u),inApp:/FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|Twitter|LinkedInApp|; wv\)|GSA\//i.test(u),standalone:matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}}
export const needsCompassPrompt=()=>typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'
/* iOS 13+ only grants compass access from a tap. Returns 'granted' | 'denied' | 'unsupported'. */
export async function askHeading(){
 if(typeof DeviceOrientationEvent==='undefined')return'unsupported'
 if(!needsCompassPrompt())return'granted'
 try{const r=await DeviceOrientationEvent.requestPermission();try{localStorage.setItem('sh_compass',r)}catch{};return r}catch{return'denied'}}
const screenAngle=()=>(screen.orientation?.angle??window.orientation??0)||0
/* compass heading in degrees (0 = north, clockwise), smoothed; null when the device gives no absolute heading.
   Updates are throttled and only fire for changes over 2°, so the map doesn't redraw on sensor noise. */
export function useHeading(){
 const[h,setH]=useState(null)
 useEffect(()=>{let cur=null,last=0,shown=null
  const push=raw=>{const v=((raw+screenAngle())%360+360)%360
   if(cur==null)cur=v;else{let d=((v-cur+540)%360)-180;cur=(cur+d*0.25+360)%360}
   const t=performance.now();if(t-last<80)return
   if(shown==null||Math.abs(((cur-shown+540)%360)-180)>=2){shown=cur;last=t;setH(Math.round(cur))}}
  const ios=e=>{if(e.webkitCompassHeading!=null)push(e.webkitCompassHeading)}
  const abs=e=>{if(e.alpha!=null&&(e.absolute||e.type==='deviceorientationabsolute'))push(360-e.alpha)}
  window.addEventListener('deviceorientation',ios);window.addEventListener('deviceorientationabsolute',abs)
  return()=>{window.removeEventListener('deviceorientation',ios);window.removeEventListener('deviceorientationabsolute',abs)}},[])
 return h
}
/* where the agent is facing: compass first, else GPS course while walking */
export const facing=(heading,pos)=>heading??pos?.course??null
