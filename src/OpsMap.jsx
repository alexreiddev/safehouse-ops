import {useEffect,useRef,useState} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {MapBtn} from './ui'
import {Locate,Layers} from './icons'
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
const getMode=()=>{try{return localStorage.getItem('sh_map')||'dark'}catch{return'dark'}}
/* circles: [{lat,lng,r,color,dash,fill}]  pins: [{lat,lng,label,color,fade,ring,onClick}]  me: {lat,lng,acc}
   ctl: classes positioning the round controls. */
export default function OpsMap({center,zoom=16,me,circles=[],pins=[],onPick,follow=false,className='absolute inset-0',ctl='right-3 top-40',controls=true}){
 const el=useRef(),m=useRef({}),pick=useRef(onPick);pick.current=onPick
 const[mode,setMode]=useState(getMode)
 useEffect(()=>{
  const map=L.map(el.current,{zoomControl:false,attributionControl:false}).setView([center.lat,center.lng],zoom)
  base(map)
  m.current={map,layer:L.layerGroup().addTo(map),me:null,acc:null,fit:false}
  map.on('click',e=>pick.current?.(e.latlng.lat,e.latlng.lng))
  const t=setTimeout(()=>map.invalidateSize(),150);return()=>{clearTimeout(t);map._gone=true;map.remove()}
 },[])
 const key=JSON.stringify([circles,pins.map(({onClick,...p})=>p)])
 useEffect(()=>{const{layer}=m.current;layer.clearLayers()
  circles.forEach(c=>L.circle([c.lat,c.lng],{radius:c.r,color:c.color||LIME,weight:2.5,dashArray:c.dash?'8 8':null,fillColor:c.fill||c.color||LIME,fillOpacity:c.fill?0.16:0.05,interactive:false}).addTo(layer))
  pins.forEach(p=>{const col=p.color||LIME,o=p.fade??1
   if(p.ring!==false)L.circleMarker([p.lat,p.lng],{radius:13,color:col,weight:2,fill:false,opacity:o*.7,interactive:false}).addTo(layer)
   const mk=L.circleMarker([p.lat,p.lng],{radius:8,color:INK,weight:2,fillColor:col,fillOpacity:o,opacity:o}).addTo(layer)
   if(p.label)mk.bindTooltip(p.label,{permanent:true,direction:'top',offset:[0,-12]})
   if(p.onClick)mk.on('click',p.onClick)})},[key])
 useEffect(()=>{const x=m.current;if(!me)return
  if(!x.me){x.acc=L.circle([me.lat,me.lng],{radius:me.acc||0,color:LIME,weight:1,fillColor:LIME,fillOpacity:0.1,interactive:false}).addTo(x.map)
   x.ring=L.circleMarker([me.lat,me.lng],{radius:13,color:'#E7ECE8',weight:2,fill:false,interactive:false}).addTo(x.map)
   x.me=L.circleMarker([me.lat,me.lng],{radius:8,color:INK,weight:2.5,fillColor:'#E7ECE8',fillOpacity:1}).addTo(x.map)}
  else{x.me.setLatLng([me.lat,me.lng]);x.ring.setLatLng([me.lat,me.lng]);x.acc.setLatLng([me.lat,me.lng]);x.acc.setRadius(me.acc||0)}
  /* first fix: if you are off-screen, frame both you and the zone so the dot is never lost */
  if(!x.fit){x.fit=true;if(!x.map.getBounds().contains([me.lat,me.lng]))x.map.fitBounds([[me.lat,me.lng],[center.lat,center.lng]],{padding:[70,70],maxZoom:17})}
  if(follow)x.map.panTo([me.lat,me.lng],{animate:true})},[me?.lat,me?.lng,me?.acc])
 useEffect(()=>{m.current.map?.setView([center.lat,center.lng])},[center.lat,center.lng])
 const flip=()=>{const n=mode==='dark'?'day':'dark';setMode(n);try{localStorage.setItem('sh_map',n)}catch{}}
 return <div className={`${className} map-${mode}`}><div ref={el} className="absolute inset-0"/>
  {controls&&<div className={`absolute z-[1000] flex flex-col gap-3 ${ctl}`}>
   {me&&<MapBtn label="Centre on my location" onClick={()=>m.current.map.setView([me.lat,me.lng],Math.max(m.current.map.getZoom(),16))}><Locate/></MapBtn>}
   <MapBtn label={mode==='dark'?'Switch to day map':'Switch to night map'} onClick={flip} active={mode==='day'}><Layers/></MapBtn></div>}</div>
}
