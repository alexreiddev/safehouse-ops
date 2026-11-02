import {useState} from 'react'
import {Btn,Hz} from './ui'
export const TOUR=[
 ['Your city is the map','Safehouse missions are real walks. Your phone\'s GPS is the controller. Play outdoors, in daylight, in public places. Keep location on and set to Precise.'],
 ['Dead Drop: solo','Pick a drop on the radar (or let HQ choose the nearest) and walk toward the dashed circle, following the arrow and distance. A hint unlocks within 200 m; within 30 m, tap Secure intel before the clock runs out.'],
 ['ShadowHunt: squad','Friends join with a 4-letter code. Kallan hide, Police search. Police only see Kallan as timed pings, and the zone keeps shrinking. Safehouses let a Kallan vanish for a while.'],
 ['Rank up','Distance walked and speed earn XP. Climb from Recruit to Ghost and top your district\'s weekly board. Stay off roads, water edges, forests and private land. Your safety comes first.']]
export const HUNT=[
 ['Roles','Kallan hide. Police search. The host picks who is who in the lobby, or taps Random roles. Each squad is 2–10 agents with 1–3 Police.'],
 ['The host sets the rules','How often the zone shrinks, whether a caught Kallan becomes Police or is out, and how soon a safehouse can be reused. The host also places the hunt\'s safehouses, each with its own hiding time.'],
 ['1. Hide phase','Police wait. Kallan have a short countdown to get into position inside the green circle. Stay on foot, in public places, and never leave the circle.'],
 ['2. Hunt phase','Each Kallan shows on the Police map and radar as a fading pin. Pings come every few minutes, then speed up as Police close in: every 60 s within 300 m, 30 s within 150 m, 15 s within 50 m. The circle shrinks by a quarter on the host\'s schedule. Step outside it and everyone can see you; 30 seconds outside and you\'re out.'],
 ['Safehouses','⌂ spots on the map are safehouses. Step into one during the hunt and you vanish: no pings, no position, no tags, for that safehouse\'s set time. Police can\'t tell who is inside. Leave before it ends.'],
 ['3. Tagging','When Police get within tag range of a Kallan, a Tag button appears. The server checks the distance. If any Kallan survives to the end, the Kallan win.']]
export default function Guide({slides,onDone,label='Got it'}){
 const[i,setI]=useState(0),last=i===slides.length-1,[t,b]=slides[i]
 return <div className="fixed inset-0 z-[3000] bg-paper text-ink flex flex-col p-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
  <div className="flex items-center justify-between"><span className="text-mute font-semibold">{i+1} / {slides.length}</span><button onClick={onDone} className="font-semibold text-mute underline underline-offset-4">Skip</button></div>
  <div className="flex-1 flex flex-col justify-center"><h1 className="stencil text-5xl">{t}<Hz/></h1><p className="text-xl leading-snug mt-6 text-ink/90">{b}</p></div>
  <div className="flex gap-1.5 mb-4 justify-center">{slides.map((_,k)=><span key={k} className={'h-2 rounded-full '+(k===i?'w-6 bg-signal':'w-2 bg-line')}/>)}</div>
  <div className="flex gap-3">{i>0&&<Btn v="ghost" className="!w-1/3" onClick={()=>setI(i-1)}>Back</Btn>}<Btn onClick={()=>last?onDone():setI(i+1)}>{last?label:'Next'}</Btn></div></div>}
export const seen=k=>{try{return localStorage.getItem(k)==='1'}catch{return true}}
export const mark=k=>{try{localStorage.setItem(k,'1')}catch{}}
