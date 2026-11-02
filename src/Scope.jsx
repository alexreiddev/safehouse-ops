/* Static radar scope, north up: fixed rings, crosshair, ticks and cardinal labels. No sweep.
   blips: [{id, brg (deg), dist (m), color, label, fade, selected}]; onPick(id) makes blips tappable. */
const R=80
const fmtR=m=>m>=1000?(m/1000).toFixed(m%1000?1:0)+' km':Math.round(m)+' m'
export default function Scope({range,blips=[],size=240,me=true,onPick,className='',labels=true}){
 const pt=b=>{const r=Math.min(1,b.dist/range)*R,a=b.brg*Math.PI/180;return[r*Math.sin(a),-r*Math.cos(a),b.dist>range]}
 const ticks=Array.from({length:36},(_,i)=>i*10)
 return <svg viewBox="-100 -100 200 200" width={size} height={size} className={className} role="img" aria-label={`Radar, ${blips.length} contacts within ${fmtR(range)}`}>
  <circle r="96" fill="#0F1512" stroke="#2C3631" strokeWidth="1.5"/>
  {[1/3,2/3,1].map(k=><circle key={k} r={R*k} fill="none" stroke="#A3D67F" strokeOpacity={k===1?.45:.22} strokeWidth="1"/>)}
  <path d={`M0 ${-R}V${R}M${-R} 0H${R}`} stroke="#A3D67F" strokeOpacity=".22" strokeWidth="1"/>
  <path d={`M${-R*.7} ${-R*.7}L${R*.7} ${R*.7}M${R*.7} ${-R*.7}L${-R*.7} ${R*.7}`} stroke="#A3D67F" strokeOpacity=".08" strokeWidth="1"/>
  {ticks.map(t=>{const a=t*Math.PI/180,l=t%90===0?7:t%30===0?4.5:2.5;return <line key={t} x1={R*Math.sin(a)} y1={-R*Math.cos(a)} x2={(R+l)*Math.sin(a)} y2={-(R+l)*Math.cos(a)} stroke="#A3D67F" strokeOpacity=".5" strokeWidth="1"/>})}
  {labels&&<g fontFamily="Barlow Condensed,sans-serif" fontWeight="700" fontSize="12" fill="#E7ECE8" textAnchor="middle">
   <text y={-R-6}>N</text><text y={R+15}>S</text><text x={R+12} y="4">E</text><text x={-R-12} y="4">W</text></g>}
  <text x={R*.72} y={R*.86} textAnchor="middle" fontFamily="Barlow Condensed,sans-serif" fontSize="10" fontWeight="600" fill="#9AA69F">{fmtR(range)}</text>
  {blips.map((b,i)=>{const[x,y,edge]=pt(b),r=edge?4:6.5;return <g key={b.id||i} opacity={b.fade??1}
    onClick={onPick&&b.id?()=>onPick(b.id):undefined} style={onPick&&b.id?{cursor:'pointer'}:undefined}>
   {onPick&&b.id&&<circle cx={x} cy={y} r="13" fill="transparent"/>}
   {b.selected&&<circle cx={x} cy={y} r={r+5} fill="none" stroke="#E9B949" strokeWidth="2"/>}
   <circle cx={x} cy={y} r={r} fill={b.color||'#A3D67F'} stroke="#0C110F" strokeWidth="1.5"/>
   {b.label&&<text x={x} y={y-r-4} textAnchor="middle" fontFamily="Barlow Condensed,sans-serif" fontSize="9" fontWeight="700" fill="#E7ECE8">{b.label}</text>}</g>})}
  {me&&<><circle r="5" fill="#E7ECE8" stroke="#0C110F" strokeWidth="1.5"/></>}
 </svg>
}
