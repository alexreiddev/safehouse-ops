import {useEffect,useState} from 'react'
import {startRegistration,startAuthentication,browserSupportsWebAuthn} from '@simplewebauthn/browser'
import {wordlist} from '@scure/bip39/wordlists/english.js'
import {sb,uid} from './lib'
import {Btn,Screen,Field,inputCls,Err,Card} from './ui'

const WORDS=(Array.isArray(wordlist)?wordlist:String(wordlist).split('\n')).map(w=>w.trim()).filter(Boolean)
/* 6 words from the 2048-word BIP39 list: ~66 bits, generated on the device with the OS random source. */
export const genCipher=()=>Array.from(crypto.getRandomValues(new Uint16Array(6)),n=>WORDS[n&2047]).join('-')
export const canPasskey=()=>{try{return browserSupportsWebAuthn()}catch{return false}}
const fn=async body=>{const{data,error}=await sb.functions.invoke('passkey',{body})
 if(error){let m=error.message;try{m=(await error.context.json()).error||m}catch{};throw new Error(m)}
 if(data?.error)throw new Error(data.error);return data}
const nice=e=>/NotAllowed|abort|cancel/i.test(e?.name+' '+e?.message)?'Cancelled.':e?.message||'Something went wrong.'
export async function addPasskey(){const o=await fn({action:'register-options'});const r=await startRegistration({optionsJSON:o})
 return fn({action:'register-verify',response:r,label:/iPhone|iPad/.test(navigator.userAgent)?'iPhone':/Android/.test(navigator.userAgent)?'Android':'Device'})}
export async function passkeyRestore(){await uid();const o=await fn({action:'login-options'});const r=await startAuthentication({optionsJSON:o});return fn({action:'login-verify',response:r})}

/* Shown right after sign-up (and from Secure agent): issue a cipher, make the player save it. */
export function CipherReveal({onDone,again}){
 const[c]=useState(genCipher),[saved,setSaved]=useState(false),[ok,setOk]=useState(false),[err,setErr]=useState(),[copied,setCopied]=useState(false)
 const save=()=>{setErr();sb.rpc('set_cipher',{p_phrase:c}).then(({error})=>error?setErr(error.message):setSaved(true))}
 useEffect(save,[])
 const copy=()=>navigator.clipboard?.writeText(c).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000)})
 return <div className="min-h-dvh bg-ink text-paper flex flex-col gap-4 p-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
  <div className="text-paper/70 font-semibold">{again?'New cipher':'Step 2 of 2'}</div>
  <h1 className="stencil text-6xl text-signal">Your cipher</h1>
  <p className="text-lg">These 6 words bring your agent back on a new phone or after clearing the app. Screenshot them or write them down. Nobody, not even HQ, can recover them for you.{again&&' Your old cipher stops working now.'}</p>
  <ol className="grid grid-cols-2 gap-2">{c.split('-').map((w,i)=><li key={i} className="rounded-md bg-paper/10 border-2 border-paper/30 px-3 py-2 font-extrabold text-xl"><span className="text-paper/50 text-sm mr-2">{i+1}</span>{w}</li>)}</ol>
  <button onClick={copy} className="font-bold underline text-left">{copied?'Copied':'Copy to clipboard'}</button>
  {err&&<div className="flex gap-4"><Err>{err}</Err><button onClick={save} className="font-extrabold underline shrink-0">Retry</button></div>}
  <label className="flex gap-3 items-center font-bold mt-auto"><input type="checkbox" checked={ok} onChange={e=>setOk(e.target.checked)} className="size-6 accent-[#FFD21F]"/>I've saved my cipher somewhere safe</label>
  <Btn disabled={!ok||!saved} onClick={onDone}>{saved?'Continue':'Saving…'}</Btn>
  {err&&!again&&<button onClick={onDone} className="font-bold text-paper/70 underline">Skip for now (set it later in Agent security)</button>}</div>
}

export function Restore({onDone,onBack}){
 const[cs,setCs]=useState(''),[ph,setPh]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState(),pk=canPasskey()
 const viaKey=async()=>{setBusy(true);setErr();try{await passkeyRestore();onDone()}catch(e){setErr(nice(e))}setBusy(false)}
 const viaCipher=async e=>{e.preventDefault();setBusy(true);setErr();try{await uid()
  const{data,error}=await sb.rpc('restore_agent',{p_callsign:cs,p_phrase:ph});if(error)throw error;if(!data.ok)throw new Error(data.reason);onDone()}catch(e){setErr(e.message)}setBusy(false)}
 return <Screen title="Restore agent" kicker="Returning agent" onBack={onBack}>
  {pk&&<><Btn disabled={busy} onClick={viaKey}>Use fingerprint / Face ID</Btn>
   <p className="text-center text-mute font-semibold -mt-2">Works if you added a passkey before.</p>
   <div className="flex items-center gap-3 text-mute font-bold"><span className="flex-1 h-0.5 bg-line"/>or use your cipher<span className="flex-1 h-0.5 bg-line"/></div></>}
  <form onSubmit={viaCipher} className="flex flex-col gap-4">
   <Field label="Callsign"><input className={inputCls} value={cs} onChange={e=>setCs(e.target.value)} autoCapitalize="characters" maxLength={16} placeholder="NIGHTHERON"/></Field>
   <Field label="Cipher (6 words)" hint="Spaces or dashes both work."><textarea className={inputCls+' h-24'} value={ph} onChange={e=>setPh(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="word word word word word word"/></Field>
   <Err>{err}</Err>
   <Btn v={pk?'ghost':'primary'} type="submit" disabled={busy||cs.length<3||ph.trim().split(/[^a-zA-Z]+/).filter(Boolean).length!==6}>{busy?'Checking…':'Restore with cipher'}</Btn></form>
  <p className="text-sm text-mute">5 wrong tries locks that callsign for an hour.</p></Screen>
}

export function SecureScreen({onExit}){
 const[st,setSt]=useState(),[mode,setMode]=useState(),[msg,setMsg]=useState(),[err,setErr]=useState(),[busy,setBusy]=useState(false),pk=canPasskey()
 const load=()=>sb.rpc('security_status').then(({data})=>setSt(data))
 useEffect(()=>{load()},[])
 const add=async()=>{setBusy(true);setErr();setMsg();try{await addPasskey();setMsg('Passkey added. You can now restore this agent with your fingerprint or face.');load()}catch(e){setErr(nice(e))}setBusy(false)}
 if(mode==='cipher')return <CipherReveal again onDone={()=>{setMode();load()}}/>
 return <Screen title="Agent security" kicker="Keep your agent" onBack={onExit}>
  <Card className="p-4 flex flex-col gap-1">
   <div className="flex justify-between font-extrabold text-lg"><span>Cipher</span><span className={st?.cipher?'text-ok':'text-alert'}>{st==null?'…':st.cipher?'Set':'Not set'}</span></div>
   <div className="flex justify-between font-extrabold text-lg"><span>Fingerprint / Face ID</span><span className={st?.passkeys?'text-ok':'text-mute'}>{st==null?'…':st.passkeys?`${st.passkeys} passkey${st.passkeys>1?'s':''}`:'None'}</span></div></Card>
  <p>Your agent lives on this phone. If you clear the app, switch phones or open it from a different browser, use one of these to bring it back.</p>
  {pk?<Btn disabled={busy} onClick={add}>{busy?'Waiting for your phone…':'Add fingerprint / Face ID'}</Btn>:<p className="text-mute font-semibold">This browser doesn't support passkeys. Use your cipher.</p>}
  <p className="text-sm text-mute -mt-2">Saved to your phone's password manager (iCloud Keychain or Google), so it follows you to a new phone signed in to the same account.</p>
  <Btn v="ghost" onClick={()=>setMode('cipher')}>{st?.cipher?'Make a new cipher':'Create my cipher'}</Btn>
  {msg&&<Card className="p-3 font-bold">{msg}</Card>}<Err>{err}</Err></Screen>
}
