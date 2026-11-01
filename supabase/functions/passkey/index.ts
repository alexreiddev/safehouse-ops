// Passkey (WebAuthn) register + restore for Safehouse agents. Our own verification, so no email is needed.
// verify_jwt is off at the gateway because this function checks the caller's session itself.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from 'npm:@simplewebauthn/server@13.3.3'
import { isoBase64URL } from 'npm:@simplewebauthn/server@13.3.3/helpers'

const RP_ID = 'safehouse-ops.vercel.app', ORIGIN = 'https://safehouse-ops.vercel.app', RP_NAME = 'Safehouse'
const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const { action, response, label } = body
    if (action === 'health') { const { error } = await admin.from('passkeys').select('credential_id', { count: 'exact', head: true }); return json({ ok: !error, error: error?.message }) }
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: { user }, error: ue } = await admin.auth.getUser(jwt)
    if (ue || !user) return json({ error: 'Not signed in.' }, 401)
    const uid = user.id
    const saveChallenge = (challenge: string, kind: string) => admin.from('webauthn_challenges').upsert({ user_id: uid, challenge, kind, expires_at: new Date(Date.now() + 5 * 60e3).toISOString() })
    const takeChallenge = async (kind: string) => {
      const { data } = await admin.from('webauthn_challenges').select().eq('user_id', uid).eq('kind', kind).maybeSingle()
      await admin.from('webauthn_challenges').delete().eq('user_id', uid)
      if (!data || new Date(data.expires_at) < new Date()) throw new Error('Request expired. Try again.')
      return data.challenge as string
    }

    if (action === 'register-options') {
      const { data: agent } = await admin.from('agents').select('id,callsign').eq('id', uid).maybeSingle()
      if (!agent) return json({ error: 'Create your agent first.' }, 400)
      const { data: existing } = await admin.from('passkeys').select('credential_id,transports').eq('agent_id', uid)
      if ((existing || []).length >= 5) return json({ error: 'You already have 5 passkeys.' }, 400)
      const opts = await generateRegistrationOptions({
        rpName: RP_NAME, rpID: RP_ID, userName: agent.callsign, userDisplayName: `Agent ${agent.callsign}`,
        userID: new TextEncoder().encode(uid), attestationType: 'none',
        excludeCredentials: (existing || []).map((c) => ({ id: c.credential_id, transports: c.transports || undefined })),
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      })
      await saveChallenge(opts.challenge, 'reg')
      return json(opts)
    }

    if (action === 'register-verify') {
      const expectedChallenge = await takeChallenge('reg')
      const v = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID, requireUserVerification: true })
      if (!v.verified) return json({ error: 'Passkey could not be verified.' }, 400)
      const c = v.registrationInfo.credential
      const { error } = await admin.from('passkeys').insert({ credential_id: c.id, agent_id: uid, public_key: isoBase64URL.fromBuffer(c.publicKey), counter: c.counter, transports: c.transports || null, label: String(label || '').slice(0, 40) || null })
      if (error) return json({ error: error.code === '23505' ? 'This passkey is already registered.' : error.message }, 400)
      return json({ ok: true })
    }

    if (action === 'login-options') {
      const { data: agent } = await admin.from('agents').select('id').eq('id', uid).maybeSingle()
      if (agent) return json({ error: 'This device already has an agent.' }, 400)
      const opts = await generateAuthenticationOptions({ rpID: RP_ID, userVerification: 'required', allowCredentials: [] })
      await saveChallenge(opts.challenge, 'auth')
      return json(opts)
    }

    if (action === 'login-verify') {
      const expectedChallenge = await takeChallenge('auth')
      const { data: pk } = await admin.from('passkeys').select().eq('credential_id', response?.id).maybeSingle()
      if (!pk) return json({ error: 'That passkey isn\'t linked to any agent.' }, 400)
      const v = await verifyAuthenticationResponse({
        response, expectedChallenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID, requireUserVerification: true,
        credential: { id: pk.credential_id, publicKey: isoBase64URL.toBuffer(pk.public_key), counter: Number(pk.counter), transports: pk.transports || undefined },
      })
      if (!v.verified) return json({ error: 'Passkey could not be verified.' }, 400)
      await admin.from('passkeys').update({ counter: v.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq('credential_id', pk.credential_id)
      if (pk.agent_id === uid) return json({ ok: true })
      const { data: cs, error } = await admin.rpc('_transfer_agent', { p_old: pk.agent_id, p_new: uid })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, callsign: cs })
    }
    return json({ error: 'Unknown action.' }, 400)
  } catch (e) { return json({ error: String((e as Error)?.message || e) }, 400) }
})
