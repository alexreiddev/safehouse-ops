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

/* live GPS + screen wake lock while a mission screen is open */
export function useGeo(keepAwake=true){
 const[pos,setPos]=useState(),[err,setErr]=useState(),ref=useRef()
 useEffect(()=>{let wl
  const w=navigator.geolocation.watchPosition(g=>{const p={lat:g.coords.latitude,lng:g.coords.longitude,acc:g.coords.accuracy};ref.current=p;setPos(p);setErr()},
   e=>setErr(e.code===1?'Location is blocked. Allow location for this site in your browser settings, then reload.':'Waiting for a GPS fix. Step into the open.'),
   {enableHighAccuracy:true,maximumAge:0,timeout:20000})
  const lock=()=>{if(document.visibilityState==='visible')navigator.wakeLock?.request('screen').then(x=>wl=x).catch(()=>{})}
  if(keepAwake){lock();document.addEventListener('visibilitychange',lock)}
  return()=>{navigator.geolocation.clearWatch(w);wl?.release();document.removeEventListener('visibilitychange',lock)}},[])
 return[pos,err,ref]
}
export function useNow(ms=1000){const[n,setN]=useState(Date.now());useEffect(()=>{const i=setInterval(()=>setN(Date.now()),ms);return()=>clearInterval(i)},[ms]);return n}

/* compass heading in degrees (0 = north), or null when the device has no compass.
   iOS needs askHeading() from a tap before it reports. */
export async function askHeading(){try{if(typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission)await DeviceOrientationEvent.requestPermission()}catch{}}
export function useHeading(){
 const[h,setH]=useState(null)
 useEffect(()=>{
  const ios=e=>{if(e.webkitCompassHeading!=null)setH(e.webkitCompassHeading)}
  const abs=e=>{if(e.absolute&&e.alpha!=null)setH((360-e.alpha)%360)}
  window.addEventListener('deviceorientation',ios);window.addEventListener('deviceorientationabsolute',abs)
  return()=>{window.removeEventListener('deviceorientation',ios);window.removeEventListener('deviceorientationabsolute',abs)}},[])
 return h
}
