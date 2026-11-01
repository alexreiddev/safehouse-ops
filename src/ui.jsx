const V={primary:'bg-signal text-ink border-2 border-ink shadow-[0_4px_0_var(--color-ink)] active:shadow-[0_1px_0_var(--color-ink)] active:translate-y-[3px]',
 ghost:'bg-card text-ink border-2 border-ink active:translate-y-px',danger:'bg-transparent text-alert border-2 border-alert active:translate-y-px',
 dark:'bg-ink text-paper border-2 border-ink active:translate-y-px'}
export const Btn=({v='primary',className='',...p})=><button {...p} className={`w-full rounded-md py-4 px-5 text-xl font-extrabold tracking-tight transition-transform disabled:opacity-40 disabled:pointer-events-none ${V[v]} ${className}`}/>
export const inputCls='w-full rounded-md border-2 border-ink bg-card px-4 py-3 text-lg font-semibold placeholder:text-mute/60'
export const Field=({label,hint,children})=><label className="block"><span className="block font-bold mb-1">{label}</span>{children}{hint&&<span className="block text-sm text-mute mt-1">{hint}</span>}</label>
export const Pick=({label,v,o,set,fmt=x=>x})=><div><div className="font-bold mb-1">{label}</div><div className="flex gap-1.5">{o.map(x=>
 <button type="button" key={x} onClick={()=>set(x)} aria-pressed={x===v} className={'flex-1 rounded-md border-2 py-2 font-bold '+(x===v?'bg-ink text-paper border-ink':'border-line bg-card')}>{fmt(x)}</button>)}</div></div>
export function Screen({title,kicker,onBack,right,children}){return <div className="min-h-dvh flex flex-col">
 <header className="bg-ink text-paper px-4 pt-[max(.9rem,env(safe-area-inset-top))] pb-3 flex items-end gap-3">
  {onBack&&<button onClick={onBack} aria-label="Back" className="text-3xl leading-none font-black pr-1 -mb-0.5">‹</button>}
  <div className="flex-1 min-w-0">{kicker&&<div className="text-sm text-paper/70 font-semibold">{kicker}</div>}<h1 className="stencil text-4xl truncate">{title}</h1></div>{right}</header>
 <main className="flex-1 p-4 flex flex-col gap-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</main></div>}
const SC={alert:'text-alert border-alert',ok:'text-ok border-ok',ink:'text-ink border-ink'}
export const Stamp=({children,c='alert',className=''})=><div className={`stamp-in inline-block -rotate-6 border-[5px] rounded px-4 pt-2 pb-1 stencil text-6xl ${SC[c]} ${className}`}>{children}</div>
export const Err=({children})=>children?<div role="alert" className="rounded-md bg-alert/10 border-2 border-alert text-alert font-semibold px-3 py-2">{children}</div>:null
export const Card=({className='',...p})=><div {...p} className={`rounded-md border-2 border-ink bg-card ${className}`}/>

export const GpsBar=({pos,className=''})=>{
 if(!pos)return <div className={`inline-block rounded px-2 py-0.5 text-sm font-extrabold bg-line text-ink ${className}`}>GPS: searching…</div>
 const a=Math.round(pos.acc),c=a<=30?'bg-ok text-paper':a<=100?'bg-signal text-ink':'bg-alert text-paper'
 return <div className={className}><span className={`inline-block rounded px-2 py-0.5 text-sm font-extrabold ${c}`}>GPS ±{a} m</span>
  {a>500&&<p className="text-sm font-semibold text-alert mt-1">Your phone is sharing only approximate location. Turn on Precise location for this browser or app in phone settings, then reopen.</p>}
  {a>100&&a<=500&&<p className="text-sm font-semibold text-mute mt-1">Weak fix. Move into the open and wait a few seconds. Laptops and indoor spots are often off by hundreds of metres.</p>}</div>}
