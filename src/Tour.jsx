import {useState} from 'react'
import {Btn} from './ui'
export const TOUR=[
 ['Your city is the map','Safehouse missions are real walks. Your phone\'s GPS is the controller. Play outdoors, in daylight, in public places. Keep location on and set to Precise.'],
 ['Dead Drop: solo','Tap Find a drop and HQ picks the nearest hidden intel. Walk toward the dashed circle following the arrow and distance. A hint unlocks within 200 m; within 30 m, tap Secure intel before the clock runs out.'],
 ['ShadowHunt: squad','Friends join with a 4-letter code. Shadows hide, hunters search. Hunters only see shadows as timed pings, and the zone keeps shrinking. Tag a shadow and it joins the hunters.'],
 ['Rank up','Distance walked and speed earn XP. Climb from Recruit to Ghost and top your district\'s weekly board. Stay off roads, water edges, forests and private land. Your safety comes first.']]
export const HUNT=[
 ['Roles','Shadows hide. Hunters search. The host picks who is who in the lobby, or taps Random roles. Each squad is 2–10 agents with 1–3 hunters.'],
 ['1. Hide phase','Hunters wait. Shadows have a short countdown to get into position inside the blue circle. Stay on foot, in public places, and never leave the circle.'],
 ['2. Hunt phase','Each shadow is revealed on the map and radar as a fading pin. Pings come every few minutes, then speed up as a hunter closes in: every 60 s within 300 m, 30 s within 150 m, 15 s within 50 m. Every 10 minutes the circle shrinks by a quarter. Step outside it and everyone can see you; a shadow who stays outside for 30 seconds is out and joins the hunters.'],
 ['Safehouses','Green ⌂ spots on the map are safehouses. A shadow who reaches one during the hunt gets a truce: no tags, no pings, for 1 to 4 minutes (harder-to-reach spots give longer truces). Each safehouse works once per shadow, so hunters can wait outside.'],
 ['3. Tagging','When a hunter gets within the tag range of a shadow, a Tag button appears. The server checks the distance. A tagged shadow joins the hunters. If any shadow survives to the end, the shadows win.']]
export default function Guide({slides,onDone,label='Got it'}){
 const[i,setI]=useState(0),last=i===slides.length-1,[t,b]=slides[i]
 return <div className="fixed inset-0 z-[3000] bg-ink text-paper flex flex-col p-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
  <div className="flex items-center justify-between"><span className="text-paper/70 font-bold">{i+1} / {slides.length}</span><button onClick={onDone} className="font-bold text-paper/70 underline">Skip</button></div>
  <div className="flex-1 flex flex-col justify-center"><h1 className="stencil text-6xl text-signal">{t}</h1><p className="text-xl leading-snug mt-6">{b}</p></div>
  <div className="flex gap-1.5 mb-4 justify-center">{slides.map((_,k)=><span key={k} className={'h-2 rounded-full '+(k===i?'w-6 bg-signal':'w-2 bg-paper/30')}/>)}</div>
  <div className="flex gap-3">{i>0&&<Btn v="ghost" className="!w-1/3" onClick={()=>setI(i-1)}>Back</Btn>}<Btn onClick={()=>last?onDone():setI(i+1)}>{last?label:'Next'}</Btn></div></div>}
export const seen=k=>{try{return localStorage.getItem(k)==='1'}catch{return true}}
export const mark=k=>{try{localStorage.setItem(k,'1')}catch{}}
