function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const helperId = body.helper_id;
  const requestId = body.request_id;
  if (!helperId) return json({ error: 'missing_helper' }, 400);

  const url = env?.SUPABASE_URL || env?.EXPO_PUBLIC_SUPABASE_URL;
  const key = env?.SUPABASE_SERVICE_ROLE_KEY || env?.SUPABASE_SERVICE_KEY;
  if (!url || !key) return json({ skipped: 'no_supabase' });

  const hs = await fetch(`${url}/rest/v1/helper_status?user_id=eq.${helperId}&select=contact_prefs,on_duty`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  }).then((r) => r.json()).catch(() => []);
  const row = Array.isArray(hs) ? hs[0] : null;
  if (!row?.on_duty) return json({ skipped: 'off_duty' });
  const prefs = row.contact_prefs || [];
  if (!prefs.includes('text')) return json({ skipped: 'no_sms_pref', realtime: true });

  const uv = await fetch(`${url}/rest/v1/user_verifications?user_id=eq.${helperId}&select=phone,phone_verified`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  }).then((r) => r.json()).catch(() => []);
  const phone = Array.isArray(uv) ? uv[0]?.phone : null;
  if (!phone || !uv[0]?.phone_verified) return json({ skipped: 'no_phone', realtime: true });

  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM;
  if (!sid || !token || !from) return json({ skipped: 'no_twilio', realtime: true });

  const msg = 'Rescue Army: someone nearby requested your help. Open the app to Accept or Decline.';
  const twilio = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${sid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: phone, From: from, Body: msg }),
  });
  if (!twilio.ok) {
    const t = await twilio.text();
    return json({ error: 'twilio_failed', detail: t.slice(0, 200) }, 502);
  }
  return json({ ok: true, request_id: requestId || null, sms: true });
}
