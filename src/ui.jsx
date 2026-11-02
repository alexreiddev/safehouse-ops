import {Back,Sat} from './icons'
const V={primary:'bg-signal text-onsig hover:brightness-105 active:brightness-95',
 ghost:'bg-transparent text-ink border border-line hover:bg-raise active:bg-raise',
 danger:'bg-transparent text-alert border border-alert/70 hover:bg-alert/10',
 dark:'bg-raise text-ink border border-line',
 soft:'bg-signal/10 text-signal border border-signal/60'}
export const Btn=({v='primary',className='',...p})=><button {...p} className={`w-full rounded-xl py-3.5 px-5 text-xl wide inline-flex items-center justify-center gap-2.5 transition disabled:opacity-40 disabled:pointer-events-none ${V[v]} ${className}`}/>
export const inputCls='w-full rounded-xl border border-line bg-raise px-4 py-3 text-lg font-semibold placeholder:text-mute/60 focus:border-signal outline-none'
export const Field=({label,hint,children})=><label className="block"><span className="block font-semibold text-mute mb-1.5">{label}</span>{children}{hint&&<span className="block text-sm text-mute mt-1">{hint}</span>}</label>
/* segmented choice; o items can be values or [value,label,Icon] */
export const Pick=({label,v,o,set,fmt=x=>x})=><div>{label&&<div className="font-semibold text-mute mb-1.5">{label}</div>}<div className="flex gap-2">{o.map(item=>{
 const[x,lab,Ic]=Array.isArray(item)?item:[item,fmt(item)],on=x===v
 return <button type="button" key={String(x)} onClick={()=>set(x)} aria-pressed={on} className={'flex-auto min-w-0 rounded-xl border py-2.5 px-2.5 font-semibold inline-flex items-center justify-center gap-1.5 transition '+(on?'border-amber bg-amber/15 text-ink':'border-line bg-card text-ink/90')}>
  {Ic&&<Ic className={'size-5 shrink-0 '+(on?'text-amber':'text-mute')}/>}<span className="truncate">{lab}</span></button>})}</div></div>
export const Hz=()=><span className="hz" aria-hidden="true"/>
export const Title=({children,className='text-4xl',wrap})=><h1 className={`stencil flex items-center min-w-0 ${className}`}><span className={wrap?'':'truncate'}>{children}</span><Hz/></h1>
export function Screen({title,kicker,onBack,right,children}){return <div className="min-h-dvh flex flex-col">
 <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-end gap-3">
  {onBack&&<button onClick={onBack} aria-label="Back" className="size-10 -ml-1 grid place-items-center rounded-full text-ink hover:bg-raise"><Back/></button>}
  <div className="flex-1 min-w-0">{kicker&&<div className="text-mute font-medium">{kicker}</div>}<Title>{title}</Title></div>{right}</header>
 <main className="flex-1 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1 flex flex-col gap-4">{children}</main></div>}
const SC={alert:'text-alert border-alert',ok:'text-signal border-signal',ink:'text-ink border-ink'}
export const Stamp=({children,c='alert',className=''})=><div className={`stamp-in inline-block -rotate-6 border-[5px] rounded-xl px-4 pt-2 pb-1 stencil text-6xl ${SC[c]} ${className}`}>{children}</div>
export const Err=({children})=>children?<div role="alert" className="rounded-xl bg-alert/10 border border-alert/70 text-alert font-semibold px-3 py-2">{children}</div>:null
export const Card=({className='',...p})=><div {...p} className={`rounded-2xl border border-line bg-card ${className}`}/>
export const Chip=({className='',children})=><span className={`inline-flex items-center gap-1.5 rounded-lg border border-line bg-card/90 px-2.5 py-1 text-sm wide ${className}`}>{children}</span>
/* round map control */
export const MapBtn=({label,onClick,children,active})=><button type="button" onClick={onClick} aria-label={label} aria-pressed={active}
 className={'size-12 rounded-full grid place-items-center border backdrop-blur '+(active?'bg-signal/20 border-signal text-signal':'bg-panel/80 border-line text-ink')}>{children}</button>
export const Attrib=({className=''})=><div className={`text-xs text-mute ${className}`}>
 <a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a> | © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></div>

export const GpsBar=({pos,className='',detail=true})=>{
 if(!pos)return <div className={className}><Chip><Sat className="size-4 text-mute"/>GPS searching…</Chip></div>
 const a=Math.round(pos.acc),c=a<=30?'text-signal':a<=100?'text-amber':'text-alert'
 return <div className={className}><Chip><Sat className={'size-4 '+c}/>GPS ±{a} m</Chip>
  {detail&&a>500&&<p className="text-sm font-semibold text-alert mt-1">Your phone is sharing only approximate location. Turn on Precise location for this browser or app in phone settings, then reopen.</p>}
  {detail&&a>100&&a<=500&&<p className="text-sm font-semibold text-mute mt-1">Weak fix. Move into the open and wait a few seconds. Laptops and indoor spots are often off by hundreds of metres.</p>}</div>}
