import {useEffect,useState} from 'react'
import {askHeading,platform,needsCompassPrompt} from './lib'
import {Btn,Screen,Card,Pick,Hz} from './ui'
import {Check,X,Sat,Info} from './icons'

/* First-time field check: platform-specific steps for precise location and compass,
   then live permission prompts with a result for each. */
const IOS=[
 ['Open in Safari','If you opened the link inside WhatsApp, Instagram or another app, use that app\'s menu (··· or the compass icon) and choose Open in Safari. In-app browsers often get only rough location and no compass.'],
 ['Turn on Location Services','Settings › Privacy & Security › Location Services → On.'],
 ['Give Safari precise location','On the same Location Services screen, scroll to Safari Websites → choose While Using the App, and turn on Precise Location. Without it, the app sees you only within a few kilometres.'],
 ['Let Safari ask websites','Settings › Apps › Safari › Location (on iOS 17 and earlier: Settings › Safari › Location) → Ask or Allow.'],
 ['Allow location here','Tap Allow location below, then Allow on Safari\'s prompt. If you tapped Don\'t Allow before: open the page menu (aA) in the address bar › Website Settings › Location → Allow, then reload.'],
 ['Allow the compass','Tap Enable compass below, then Allow on the Motion & Orientation prompt. If you tapped Cancel, close this tab, open the site again and tap Enable compass again.'],
 ['Optional: add to Home Screen','Share › Add to Home Screen for full-screen play. The Home Screen app asks for location and compass again the first time you open it.']]
const AND=[
 ['Open in Chrome','If you opened the link inside WhatsApp, Instagram or another app, tap ⋮ and choose Open in Chrome (or Open in browser). In-app browsers often get only rough location and no compass.'],
 ['Turn on location','Swipe down and turn on Location. Then Settings › Location › Location services › Google Location Accuracy → On (some phones call it Improve accuracy).'],
 ['Give Chrome precise location','Settings › Apps › Chrome › Permissions › Location → Allow only while using the app, and turn on Use precise location.'],
 ['Allow location here','Tap Allow location below, then Allow on Chrome\'s prompt. If Chrome offers Precise or Approximate, choose Precise. If you blocked it before: tap the icon left of the address bar › Permissions › Location → Allow, then reload.'],
 ['Allow the compass','Chrome ⋮ › Settings › Site settings › Motion sensors → Allowed. Then tap Enable compass below to check it works.'],
 ['Optional: install the app','Chrome ⋮ › Add to Home screen (or Install app) for full-screen play.']]

const Stat=({ok,warn,label,detail})=><div className="flex items-start gap-3">
 <span className={'size-8 shrink-0 rounded-full grid place-items-center border '+(ok?'border-signal text-signal':warn?'border-amber text-amber':'border-line text-mute')}>{ok?<Check className="size-5"/>:warn?<Info className="size-5"/>:<X className="size-4"/>}</span>
 <div className="min-w-0"><div className="font-semibold">{label}</div>{detail&&<div className="text-sm text-mute">{detail}</div>}</div></div>

export default function Setup({onDone,first}){
 const pf=platform()
 const[os,setOs]=useState(pf.android?'android':'ios')
 const[perm,setPerm]=useState(),[loc,setLoc]=useState(),[cmp,setCmp]=useState(),[busy,setBusy]=useState(false)
 useEffect(()=>{let st;navigator.permissions?.query({name:'geolocation'}).then(s=>{st=s;setPerm(s.state);s.onchange=()=>setPerm(s.state)}).catch(()=>{});return()=>{if(st)st.onchange=null}},[])
 const askLoc=()=>{setBusy(true);setLoc({state:'asking'})
  navigator.geolocation.getCurrentPosition(g=>{setBusy(false);const a=Math.round(g.coords.accuracy);setLoc({state:a<=60?'precise':a<=500?'weak':'rough',acc:a});setPerm('granted')},
   e=>{setBusy(false);setLoc({state:e.code===1?'denied':'timeout'});if(e.code===1)setPerm('denied')},{enableHighAccuracy:true,timeout:20000,maximumAge:0})}
 const askCmp=async()=>{setCmp({state:'asking'});const r=await askHeading()
  if(r==='denied')return setCmp({state:'denied'});if(r==='unsupported')return setCmp({state:'none'})
  let got=false;const on=e=>{const h=e.webkitCompassHeading??(e.alpha!=null&&(e.absolute||e.type==='deviceorientationabsolute')?360-e.alpha:null);if(h!=null&&!got){got=true;setCmp({state:'on',h:Math.round(h)%360})}}
  addEventListener('deviceorientation',on);addEventListener('deviceorientationabsolute',on)
  setTimeout(()=>{removeEventListener('deviceorientation',on);removeEventListener('deviceorientationabsolute',on);if(!got)setCmp({state:'none'})},3500)}
 const steps=os==='ios'?IOS:AND
 const L={asking:['Asking…'],precise:['Precise location on',`Accurate to about ${loc?.acc} m.`,1],weak:['Location on, signal weak',`About ±${loc?.acc} m. Step outside, away from buildings, and try again.`,0,1],
  rough:['Only approximate location',`About ±${loc?.acc} m: precise location is off. Follow step 3 above, then try again.`,0,1],denied:['Location blocked','Follow the "Allow location here" step to unblock it, then reload.'],timeout:['No GPS fix yet','Step into the open and try again.',0,1]}[loc?.state]
 const C={asking:['Asking…'],on:['Compass on',`Facing ${cmp?.h}°. The map can turn with you.`,1],denied:['Compass blocked','Follow the "Allow the compass" step. Without it, the map turns using GPS while you walk.',0,1],
  none:['No compass readings',pf.ios||pf.android?'Check the compass step, hold the phone flat and try again. The map still turns using GPS while you walk.':'This device has no compass. On a phone the map turns with you.',0,1]}[cmp?.state]
 return <Screen title="Field check" kicker={first?'Before your first op':'Location & compass'} onBack={first?undefined:onDone}>
  <p className="text-lg">Safehouse needs your precise location and your phone's compass. Set them up once; it takes about a minute.</p>
  {pf.inApp&&<div className="rounded-xl border border-alert/70 bg-alert/10 p-3 font-semibold">You're inside another app's browser. Open this page in {pf.ios?'Safari':'Chrome'} first (step 1).</div>}
  {!window.isSecureContext&&<div className="rounded-xl border border-alert/70 bg-alert/10 p-3 font-semibold">This page isn't on https, so the browser will block location. Open the https link.</div>}
  <Pick v={os} o={[['ios','iPhone · Safari'],['android','Android · Chrome']]} set={setOs}/>
  <Card className="p-4"><ol className="flex flex-col gap-3.5">{steps.map(([t,d],i)=><li key={t} className="flex gap-3">
   <span className="wide text-lg text-signal w-5 shrink-0">{i+1}</span><div><div className="font-semibold">{t}</div><p className="text-[.95rem] text-ink/80 leading-snug">{d}</p></div></li>)}</ol>
   <p className="mt-4 text-sm text-mute border-t border-line pt-3">Turn off battery saver while you play; it slows GPS updates. Menu names vary a little between phone brands and versions.</p></Card>
  <Card className="p-4 flex flex-col gap-4">
   <h2 className="stencil text-xl flex items-center">Check now<Hz/></h2>
   <Stat ok={loc?.state==='precise'} warn={L?.[3]} label={L?.[0]||(perm==='denied'?'Location blocked':perm==='granted'?'Location allowed':'Location not checked')} detail={L?.[1]||(perm==='denied'?'Follow the "Allow location here" step, then reload.':'Tap Allow location.')}/>
   <Btn v={loc?.state==='precise'?'ghost':'primary'} disabled={busy} onClick={askLoc}><Sat className="size-6"/>{loc?.state==='precise'?'Check location again':'Allow location'}</Btn>
   <Stat ok={cmp?.state==='on'} warn={C?.[3]} label={C?.[0]||'Compass not checked'} detail={C?.[1]||(needsCompassPrompt()?'The browser asks for Motion & Orientation access.':'Tap Enable compass.')}/>
   <Btn v={cmp?.state==='on'?'ghost':'primary'} onClick={askCmp}>{cmp?.state==='on'?'Check compass again':'Enable compass'}</Btn>
  </Card>
  <div className="mt-auto flex flex-col gap-2">
   <Btn v={loc?.state==='precise'?'primary':'ghost'} onClick={onDone}>{loc?.state==='precise'?'Done':first?'Skip for now':'Back'}</Btn>
   {first&&loc?.state!=='precise'&&<p className="text-sm text-mute text-center">You can come back here any time from the ☰ menu.</p>}</div></Screen>
}
