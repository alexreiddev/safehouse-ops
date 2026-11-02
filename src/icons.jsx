/* Line icons, 24-unit grid, stroke = currentColor. */
const I=({d,children,className='size-6',sw=1.8,...p})=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...p}>{d?<path d={d}/>:children}</svg>
export const Menu=p=><I {...p} d="M4 7h16M4 12h16M4 17h16"/>
export const Pin=p=><I {...p}><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></I>
export const ChevR=p=><I {...p} d="M9 5l7 7-7 7"/>
export const ChevD=p=><I {...p} d="M6 9l6 6 6-6"/>
export const Back=p=><I {...p} d="M19 12H5M11 6l-6 6 6 6"/>
export const Steps=p=><I {...p}><path d="M8.5 3c1.7 0 2.5 1.8 2.5 4s-1 3.5-2.5 3.5S6 9.2 6 7s.8-4 2.5-4zM6.5 13h4l-.5 3a2 2 0 0 1-3 0z"/><path d="M15.5 8c1.7 0 2.5 1.8 2.5 4s-1 3.5-2.5 3.5S13 14.2 13 12s.8-4 2.5-4zM13.5 18h4l-.5 2.2a1.8 1.8 0 0 1-3 0z"/></I>
export const Timer=p=><I {...p}><circle cx="12" cy="13.5" r="7"/><path d="M12 10v3.5l2.2 1.6M9.5 3h5M19 6.5l1.5-1.5"/></I>
export const Layers=p=><I {...p}><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12.5l9 5 9-5M3 16.5l9 5 9-5"/></I>
export const Box=p=><I {...p}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></I>
export const Target=p=><I {...p}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1.5V5M12 19v3.5M1.5 12H5M19 12h3.5"/></I>
export const Bars=p=><I {...p} sw={2.6} d="M5 20v-6M10 20V9M15 20v-8M20 20V5"/>
export const Bell=p=><I {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></I>
export const Locate=p=><I {...p}><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></I>
export const Stop=p=><I {...p}><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/></I>
export const X=p=><I {...p} d="M6 6l12 12M18 6L6 18"/>
export const Cal=p=><I {...p}><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></I>
export const Inf=p=><I {...p} d="M8 9c-2 0-3.5 1.4-3.5 3S6 15 8 15c3 0 5-6 8-6 2 0 3.5 1.4 3.5 3S18 15 16 15c-3 0-5-6-8-6z"/>
export const Hood=p=><I {...p}><path d="M5 21v-2.5C5 15 8 13 12 13s7 2 7 5.5V21"/><path d="M7.5 11.5C7 6 9 3 12 3s5 3 4.5 8.5"/><path d="M9.5 9.5c.5 2 1.5 3 2.5 3s2-1 2.5-3"/></I>
export const Shield=p=><I {...p}><path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z"/><path d="M12 8.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z"/></I>
export const Mask=p=><I {...p}><path d="M3 9c3-1.5 6-2 9-2s6 .5 9 2c0 4-2 7-5 7-1.6 0-2.5-1.5-4-1.5S9.6 16 8 16c-3 0-5-3-5-7z"/><path d="M7 11.5c.8-.6 1.8-.6 2.6 0M14.4 11.5c.8-.6 1.8-.6 2.6 0"/></I>
export const Home=p=><I {...p} d="M4 11l8-6.5 8 6.5M6 9.5V20h12V9.5M10 20v-5h4v5"/>
export const Sat=p=><I {...p}><path d="M13 7l4 4-6 6-4-4z"/><path d="M15 5l2-2 4 4-2 2M9 15l-2 2-4-4 2-2M16 16a5 5 0 0 0 3-3M17.5 19a8 8 0 0 0 4.5-4.5"/></I>
export const Walk=p=><I {...p}><circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2.5-6.5L15 17v4M12.5 14.5L11.5 9l-3.5 2v3.5M11.5 9l3 1.5L17 13"/></I>
export const Info=p=><I {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/></I>
export const Peaks=p=><I {...p}><path d="M3 18l6-9 3.5 5 2.5-3.5L21 18z"/><path d="M8 11.5l1-1.5 1.2 1.6"/></I>
export const Check=p=><I {...p} d="M5 12.5l4.5 4.5L19 7"/>
export const Plus=p=><I {...p} d="M12 5v14M5 12h14"/>
export const Trash=p=><I {...p} d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>
/* rank badge: hexagon with peaks */
export const Badge=({className='size-16'})=><svg viewBox="0 0 64 64" className={className} aria-hidden="true">
 <path d="M32 4l24 14v28L32 60 8 46V18z" fill="none" stroke="var(--color-signal)" strokeWidth="2.5" strokeLinejoin="round"/>
 <path d="M16 42l10-14 6 8 4-5 12 11z" fill="var(--color-signal)" opacity=".9"/><path d="M24 31l2-3 2.5 3.4" stroke="var(--color-paper)" strokeWidth="1.6" fill="none"/></svg>
/* laurel ring for leaderboard top 3 */
export const Laurel=({n,color,className='size-11'})=><svg viewBox="0 0 44 44" className={className} aria-hidden="true">
 <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M14 35C8 31 6 24 8 16"/><path d="M30 35c6-4 8-11 6-19"/></g>
 <g fill={color}>{[[9,30,-40],[7.5,24,-15],[8,18,10]].map(([x,y,r],i)=><ellipse key={i} cx={x} cy={y} rx="1.6" ry="3.2" transform={`rotate(${r} ${x} ${y})`}/>)}
  {[[35,30,40],[36.5,24,15],[36,18,-10]].map(([x,y,r],i)=><ellipse key={'r'+i} cx={x} cy={y} rx="1.6" ry="3.2" transform={`rotate(${r} ${x} ${y})`}/>)}</g>
 <text x="22" y="28" textAnchor="middle" fontFamily="Barlow Condensed,sans-serif" fontWeight="700" fontSize="17" fill={color}>{n}</text></svg>
