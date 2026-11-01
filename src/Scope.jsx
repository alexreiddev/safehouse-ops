/* Radar scope, north up. blips: [{brg (deg), dist (m), color, label, fade}] */
const R=88
export default function Scope({range,blips=[],size=260,me=true,className=''}){
 const pt=b=>{const r=Math.min(1,b.dist/range)*R,a=b.brg*Math.PI/180;return[r*Math.sin(a),-r*Math.cos(a),b.dist>range]}
 const fmtR=m=>m>=1000?(m/1000).toFixed(m%1000?1:0)+' km':Math.round(m)+' m'
 return <svg viewBox="-100 -100 200 200" width={size} height={size} className={className} role="img" aria-label={`Radar, ${blips.length} contacts within ${fmtR(range)}`}>
  <defs><radialGradient id="scopebg"><stop offset="0" stopColor="#1d3326"/><stop offset="1" stopColor="#0d1711"/></radialGradient>
   <linearGradient id="sweepg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5BE38C" stopOpacity=".45"/><stop offset="1" stopColor="#5BE38C" stopOpacity="0"/></linearGradient></defs>
  <circle r="96" fill="url(#scopebg)" stroke="#13201A" strokeWidth="4"/>
  {[1/3,2/3,1].map(k=><circle key={k} r={R*k} fill="none" stroke="#5BE38C" strokeOpacity=".28" strokeWidth="1"/>)}
  <path d={`M0 ${-R}V${R}M${-R} 0H${R}`} stroke="#5BE38C" strokeOpacity=".2" strokeWidth="1"/>
  <g className="sweep"><path d={`M0 0L${R} 0A${R} ${R} 0 0 0 ${R*Math.cos(-.9)} ${R*Math.sin(-.9)}Z`} fill="url(#sweepg)"/></g>
  <text x="0" y={-R+11} textAnchor="middle" fontSize="10" fontWeight="800" fill="#5BE38C">N</text>
  <text x={R*.7} y={R*.7+10} textAnchor="middle" fontSize="8" fontWeight="700" fill="#5BE38C" fillOpacity=".7">{fmtR(range)}</text>
  {blips.map((b,i)=>{const[x,y,edge]=pt(b);return <g key={i} opacity={b.fade??1}>
   <circle cx={x} cy={y} r={edge?3.5:5.5} fill={b.color||'#FFD21F'} className="blip" style={{animationDelay:(((b.brg-90+360)%360)/360*4)+'s'}}/>
   {b.label&&<text x={x} y={y-8} textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">{b.label}</text>}</g>})}
  {me&&<circle r="4" fill="#fff" stroke="#13201A" strokeWidth="1.5"/>}
 </svg>
}
