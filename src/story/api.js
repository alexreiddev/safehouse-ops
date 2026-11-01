import {useEffect,useRef,useState} from 'react'
import {sb} from '../lib'

export const rpc=async(fn,args)=>{const{data,error}=await sb.rpc(fn,args);if(error)throw new Error(error.message);return data}

let ctx
export const unlockAudio=()=>{try{ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume()}catch{}}
// One soft bell: a fundamental plus two quiet partials, long decay.
export const bell=()=>{try{unlockAudio();if(!ctx)return;const t=ctx.currentTime
 ;[[660,.35],[990,.12],[1650,.05]].forEach(([f,g])=>{const o=ctx.createOscillator(),v=ctx.createGain()
  o.type='sine';o.frequency.value=f;v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(g,t+.015)
  v.gain.exponentialRampToValueAtTime(.0001,t+3.2);o.connect(v).connect(ctx.destination);o.start(t);o.stop(t+3.3)})
 navigator.vibrate?.(90)}catch{}}

export function useWatch(){
 const[pos,setPos]=useState(),[err,setErr]=useState(),ref=useRef()
 useEffect(()=>{if(!navigator.geolocation){setErr('This device has no GPS.');return}
  const id=navigator.geolocation.watchPosition(p=>{const v={lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy};ref.current=v;setPos(v);setErr()},
   e=>setErr(e.code===1?'Location is blocked. Allow it for this site to play.':'Waiting for GPS…'),{enableHighAccuracy:true,maximumAge:5000,timeout:20000})
  return()=>navigator.geolocation.clearWatch(id)},[])
 return[pos,err,ref]}

export const here=()=>new Promise((ok,no)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>ok({lat:p.coords.latitude,lng:p.coords.longitude}),no,{enableHighAccuracy:true,timeout:20000}):no(new Error('No GPS')))

export const bearing=(a,b,c,d)=>{const r=Math.PI/180,y=Math.sin((d-b)*r)*Math.cos(c*r),x=Math.cos(a*r)*Math.sin(c*r)-Math.sin(a*r)*Math.cos(c*r)*Math.cos((d-b)*r);return(Math.atan2(y,x)/r+360)%360}
export const dir8=b=>['north','north-east','east','south-east','south','south-west','west','north-west'][Math.round(b/45)%8]
export const hm=iso=>new Date(iso).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
export const when=iso=>new Date(iso).toLocaleString('en-IN',{weekday:'short',hour:'2-digit',minute:'2-digit'})
export const meters=m=>m==null?'—':m<1000?`${m} m`:`${(m/1000).toFixed(m<10000?1:0)} km`
