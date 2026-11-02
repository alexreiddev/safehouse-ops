import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {MapBtn} from './ui'
import {Locate,Layers} from './icons'
import {askHeading,needsCompassPrompt} from './lib'
const OSM=()=>L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19})
const webgl=(()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}})()
/* Base map: OpenFreeMap vector tiles (free, no key, no request limits), loaded lazily; raster OSM if WebGL is missing or it fails.
   The dark look is a CSS filter on the tile pane, so roads, labels and places stay true OSM data. */
function base(map){
 if(!webgl)return OSM().addTo(map)
 Promise.all([import('@maplibre/maplibre-gl-leaflet'),import('maplibre-gl/dist/maplibre-gl.css')]).then(()=>{
  if(map._gone)return
  L.maplibreGL({style:'https://tiles.openfreemap.org/styles/liberty',pane:'tilePane',attribution:'OpenFreeMap © OpenMapTiles © OpenStreetMap contributors'}).addTo(map)
 }).catch(()=>OSM().addTo(map))
}
const LIME='#A3D67F',INK='#0C110F'
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const ls=(k,d)=>{try{return localStorage.getItem(k)||d}catch{return d}}
const save=(k,v)=>{try{localStorage.setItem(k,v)}catch{}}
/* you: white dot, plus a facing cone when the heading is known */
const meIcon=()=>L.divIcon({className:'me-icon',iconSize:[44,44],iconAnchor:[22,22],html:
 '<svg viewBox="-22 -22 44 44" width="44" height="44"><g class="me-cone" style="display:none"><path d="M0 0 L-9 -19 A21 21 0 0 1 9 -19 Z" fill="#A3D67F" fill-opacity=".35"/></g><circle r="13" fill="none" stroke="#E7ECE8" stroke-width="2"/><circle r="7.5" fill="#E7ECE8" stroke="#0C110F" stroke-width="2.5"/></svg>'})

/* circles: [{lat,lng,r,color,dash,fill}]  pins: [{lat,lng,label,color,fade,ring,onClick}]  me: {lat,lng,acc}
   heading: where the agent faces (deg) or null. rotatable: allow heading-up mode (map turns with you; drag is off,
   zoom stays centred on you). ctl: classes positioning the round controls. */
export default function OpsMap({center,zoom=16,me,circles=[],pins=[],onPick,follow=false,className='absolute inset-0',ctl='right-3 top-40',controls=true,heading=null,rotatable=false}){
 const el=useRef(),box=useRef(),m=useRef({}),pick=useRef(onPick);pick.current=onPick
 const[mode,setMode]=useState(()=>ls('sh_map','dark'))
 const[orient,setOrient]=useState(()=>rotatable?ls('sh_orient','up'):'north')
 const[size,setSize]=useState({w:0,h:0}),turn=useRef(0)
 const up=rotatable&&orient==='up'
 /* unwrap 359→0 so the CSS transition always takes the short way round */
 const target=up&&heading!=null?heading:0
 {const d=((target-turn.current)%360+540)%360-180;turn.current+=d}
 const ang=turn.current
 useEffect(()=>{
  const map=L.map(el.current,{zoomControl:false,attributionControl:false}).setView([center.lat,center.lng],zoom)
  base(map)
  m.current={map,layer:L.layerGroup().addTo(map),me:null,acc:null,fit:false}
  map.on('click',e=>pick.current?.(e.latlng.lat,e.latlng.lng))
  const t=setTimeout(()=>map.invalidateSize(),150);return()=>{clearTimeout(t);map._gone=true;map.remove()}
 },[])
 useLayoutEffect(()=>{const ro=new ResizeObserver(([e])=>setSize({w:e.contentRect.width,h:e.contentRect.height}));ro.observe(box.current);return()=>ro.disconnect()},[])
 /* heading-up: square, oversized map so corners never show while it turns; centre on you; no drag (it would move sideways) */
 useEffect(()=>{const{map}=m.current;if(!map)return
  map.invalidateSize({pan:false})
  if(up){map.dragging.disable();map.options.touchZoom='center';map.options.scrollWheelZoom='center'
   if(me)map.setView([me.lat,me.lng],map.getZoom(),{animate:false})}
  else{map.dragging.enable();map.options.touchZoom=true;map.options.scrollWheelZoom=true}},[up,size.w,size.h])
 const key=JSON.stringify([circles,pins.map(({onClick,...p})=>p)])
 useEffect(()=>{const{layer}=m.current;layer.clearLayers()
  circles.forEach(c=>L.circle([c.lat,c.lng],{radius:c.r,color:c.color||LIME,weight:2.5,dashArray:c.dash?'8 8':null,fillColor:c.fill||c.color||LIME,fillOpacity:c.fill?0.16:0.05,interactive:false}).addTo(layer))
  pins.forEach(p=>{const col=p.color||LIME,o=p.fade??1
   if(p.ring!==false)L.circleMarker([p.lat,p.lng],{radius:13,color:col,weight:2,fill:false,opacity:o*.7,interactive:false}).addTo(layer)
   const mk=L.circleMarker([p.lat,p.lng],{radius:8,color:INK,weight:2,fillColor:col,fillOpacity:o,opacity:o}).addTo(layer)
   if(p.label)mk.bindTooltip(`<span class="tt">${esc(p.label)}</span>`,{permanent:true,direction:'top',offset:[0,-12]})
   if(p.onClick)mk.on('click',p.onClick)})},[key])
 useEffect(()=>{const x=m.current;if(!me)return
  if(!x.me){x.acc=L.circle([me.lat,me.lng],{radius:me.acc||0,color:LIME,weight:1,fillColor:LIME,fillOpacity:0.1,interactive:false}).addTo(x.map)
   x.me=L.marker([me.lat,me.lng],{icon:meIcon(),interactive:false,keyboard:false}).addTo(x.map)}
  else{x.me.setLatLng([me.lat,me.lng]);x.acc.setLatLng([me.lat,me.lng]);x.acc.setRadius(me.acc||0)}
  /* first fix: if you are off-screen, frame both you and the zone so the dot is never lost */
  if(!x.fit&&!up){x.fit=true;if(!x.map.getBounds().contains([me.lat,me.lng]))x.map.fitBounds([[me.lat,me.lng],[center.lat,center.lng]],{padding:[70,70],maxZoom:17})}
  if(follow||up)x.map.panTo([me.lat,me.lng],{animate:true})},[me?.lat,me?.lng,me?.acc])
 /* facing cone on your dot (it turns with the map, so in heading-up mode it points straight up) */
 useEffect(()=>{const g=m.current.me?.getElement()?.querySelector('.me-cone');if(!g)return
  if(heading==null){g.style.display='none';return}
  g.style.display='';g.setAttribute('transform',`rotate(${heading})`)},[heading,!!me])
 useEffect(()=>{if(!up)m.current.map?.setView([center.lat,center.lng])},[center.lat,center.lng])
 const flip=()=>{const n=mode==='dark'?'day':'dark';setMode(n);save('sh_map',n)}
 const toggleOrient=async()=>{const n=orient==='up'?'north':'up';if(n==='up'&&needsCompassPrompt())await askHeading();setOrient(n);save('sh_orient',n)}
 const D=Math.ceil(Math.hypot(size.w,size.h))
 return <div ref={box} className={`${className} overflow-hidden map-${mode} ${up?'map-rot':''}`}>
  <div style={up&&D?{position:'absolute',width:D,height:D,left:'50%',top:'50%',transform:`translate(-50%,-50%) rotate(${-ang}deg)`,transition:'transform .3s linear','--rot':`${ang}deg`}:{position:'absolute',inset:0}}>
   <div ref={el} className="absolute inset-0"/></div>
  {controls&&<div className={`absolute z-[1000] flex flex-col gap-3 ${ctl}`}>
   {rotatable&&<MapBtn label={up?'Map turns with you. Tap for north up':'North up. Tap to turn the map with you'} onClick={toggleOrient} active={up}>
    <svg viewBox="0 0 24 24" className="size-7" aria-hidden="true" style={{transform:`rotate(${-ang}deg)`,transition:'transform .3s linear'}}>
     <path d="M12 2.5l3.6 9.5h-7.2z" fill="#E5584F"/><path d="M12 21.5l3.6-9.5h-7.2z" fill="currentColor" opacity=".85"/><text x="12" y="10.4" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#fff" fontFamily="Barlow Condensed,sans-serif">N</text></svg></MapBtn>}
   {me&&<MapBtn label="Centre on my location" onClick={()=>m.current.map.setView([me.lat,me.lng],Math.max(m.current.map.getZoom(),16))}><Locate/></MapBtn>}
   <MapBtn label={mode==='dark'?'Switch to day map':'Switch to night map'} onClick={flip} active={mode==='day'}><Layers/></MapBtn></div>}
  {up&&heading==null&&controls&&<div className="absolute left-3 bottom-3 z-[1000] rounded-lg bg-panel/85 border border-line px-2.5 py-1 text-xs text-mute">Waiting for compass… walk a few steps</div>}</div>
}
