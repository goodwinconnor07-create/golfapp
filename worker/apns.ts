// Sends push notifications to the iPhone app through Apple's push service (APNs), straight from
// the Worker. Signs in with an APNs auth key (.p8) and a short-lived ES256 token. Does nothing
// until the APNS_* secrets are set (see docs/IOS.md), so the website works the same without them.
//
// Secrets: APNS_KEY (the .p8 file's contents), APNS_KEY_ID, APNS_TEAM_ID.
// Var: APNS_HOST, "api.push.apple.com" by default (TestFlight and App Store builds). Use
// "api.sandbox.push.apple.com" for builds run straight from Xcode.

const TOPIC = 'app.cardshot.ios';
/** Apple wants a fresh token at most every 20 minutes and accepts one for up to an hour. */
const TOKEN_TTL_MS = 50 * 60 * 1000;

export interface ApnsEnv {
  APNS_KEY?: string;
  APNS_KEY_ID?: string;
  APNS_TEAM_ID?: string;
  APNS_HOST?: string;
}

export interface PushResult {
  token: string;
  /** Apple says this token is dead (app deleted, notifications off): stop using it. */
  gone: boolean;
}

let cached: { jwt: string; made: number; keyId: string } | null = null;

export function apnsConfigured(env: ApnsEnv): boolean {
  return Boolean(env.APNS_KEY && env.APNS_KEY_ID && env.APNS_TEAM_ID);
}

/** Sends one alert to each token. Never throws; returns which tokens Apple has retired. */
export async function sendPush(env: ApnsEnv, tokens: string[], alert: { title: string; body: string }): Promise<PushResult[]> {
  if (!apnsConfigured(env) || tokens.length === 0) return [];
  let jwt: string;
  try {
    jwt = await providerToken(env);
  } catch (e) {
    console.error('APNs key could not be used', e);
    return [];
  }
  const host = env.APNS_HOST || 'api.push.apple.com';
  // A full origin is allowed too, for testing against a local stand-in.
  const base = host.startsWith('http') ? host : `https://${host}`;
  const payload = JSON.stringify({ aps: { alert, sound: 'default' } });
  return Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(`${base}/3/device/${token}`, {
          method: 'POST',
          headers: {
            authorization: `bearer ${jwt}`,
            'apns-topic': TOPIC,
            'apns-push-type': 'alert',
            'apns-priority': '10',
            // Not worth delivering an hour late on a golf course.
            'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
          },
          body: payload,
        });
        if (res.ok) return { token, gone: false };
        const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason ?? '';
        if (res.status === 403 && /ProviderToken/.test(reason)) cached = null;
        if (res.status !== 410 && reason !== 'BadDeviceToken') console.warn('APNs refused a push', res.status, reason);
        return { token, gone: res.status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered' };
      } catch (e) {
        console.warn('APNs unreachable', e);
        return { token, gone: false };
      }
    }),
  );
}

async function providerToken(env: ApnsEnv): Promise<string> {
  const keyId = env.APNS_KEY_ID!;
  if (cached && cached.keyId === keyId && Date.now() - cached.made < TOKEN_TTL_MS) return cached.jwt;
  const der = Uint8Array.from(
    atob(
      // Pasted keys sometimes arrive with literal "\n"s instead of line breaks.
      env.APNS_KEY!.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\\n|\s+/g, ''),
    ),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = (obj: object) => base64url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${enc({ alg: 'ES256', kid: keyId })}.${enc({ iss: env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })}`;
  // WebCrypto gives the raw r||s signature, which is what a JWT's ES256 wants.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(new Uint8Array(sig))}`;
  cached = { jwt, made: Date.now(), keyId };
  return jwt;
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
