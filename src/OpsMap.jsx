import {useEffect,useRef} from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
const OSM=()=>L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19})
const webgl=(()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}})()
/* Base map: OpenFreeMap vector tiles (free, no key, no request limits), loaded lazily; raster OSM if WebGL is missing or it fails. */
function base(map){
 if(!webgl)return OSM().addTo(map)
 Promise.all([import('@maplibre/maplibre-gl-leaflet'),import('maplibre-gl/dist/maplibre-gl.css')]).then(()=>{
  if(map._gone)return
  const gl=L.maplibreGL({style:'https://tiles.openfreemap.org/styles/liberty',attribution:'<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> © OpenStreetMap contributors'})
  gl.addTo(map)
 }).catch(()=>OSM().addTo(map))
}
/* circles: [{lat,lng,r,color,dash,fill}]  pins: [{lat,lng,label,color,fade}]  me: {lat,lng,acc} */
export default function OpsMap({center,zoom=16,me,circles=[],pins=[],onPick,follow=false,className='absolute inset-0'}){
 const el=useRef(),m=useRef({}),pick=useRef(onPick);pick.current=onPick
 useEffect(()=>{
  const map=L.map(el.current,{zoomControl:false}).setView([center.lat,center.lng],zoom)
  base(map)
  m.current={map,layer:L.layerGroup().addTo(map),me:null,acc:null,fit:false}
  map.on('click',e=>pick.current?.(e.latlng.lat,e.latlng.lng))
  const t=setTimeout(()=>map.invalidateSize(),150);return()=>{clearTimeout(t);map._gone=true;map.remove()}
 },[])
 const key=JSON.stringify([circles,pins])
 useEffect(()=>{const{layer}=m.current;layer.clearLayers()
  circles.forEach(c=>L.circle([c.lat,c.lng],{radius:c.r,color:c.color||'#13201A',weight:3,dashArray:c.dash?'8 8':null,fillColor:c.fill||c.color||'#13201A',fillOpacity:c.fill?0.18:0.06}).addTo(layer))
  pins.forEach(p=>{const mk=L.circleMarker([p.lat,p.lng],{radius:9,color:'#fff',weight:2,fillColor:p.color||'#C8231A',fillOpacity:p.fade??1}).addTo(layer)
   if(p.label)mk.bindTooltip(p.label,{permanent:true,direction:'top',offset:[0,-8]})
   if(p.onClick)mk.on('click',p.onClick)})},[key])
 useEffect(()=>{const x=m.current;if(!me)return
  if(!x.me){x.me=L.circleMarker([me.lat,me.lng],{radius:9,color:'#13201A',weight:3,fillColor:'#FFD21F',fillOpacity:1}).addTo(x.map);x.acc=L.circle([me.lat,me.lng],{radius:me.acc||0,color:'#13201A',weight:1,fillColor:'#FFD21F',fillOpacity:0.15,interactive:false}).addTo(x.map)}
  else{x.me.setLatLng([me.lat,me.lng]);x.acc.setLatLng([me.lat,me.lng]);x.acc.setRadius(me.acc||0)}
  /* first fix: if you are off-screen, frame both you and the zone so the dot is never lost */
  if(!x.fit){x.fit=true;if(!x.map.getBounds().contains([me.lat,me.lng]))x.map.fitBounds([[me.lat,me.lng],[center.lat,center.lng]],{padding:[70,70],maxZoom:17})}
  if(follow)x.map.panTo([me.lat,me.lng],{animate:true})},[me?.lat,me?.lng,me?.acc])
 useEffect(()=>{m.current.map?.setView([center.lat,center.lng])},[center.lat,center.lng])
 return <div className={className}><div ref={el} className="absolute inset-0"/>
  {me&&<button type="button" onClick={()=>m.current.map.setView([me.lat,me.lng],Math.max(m.current.map.getZoom(),16))} aria-label="Centre on my location" className="absolute right-3 top-32 z-[1000] size-11 rounded-full bg-card border-2 border-ink grid place-items-center shadow">
   <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="#13201A" strokeWidth="2.2"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg></button>}</div>
}
