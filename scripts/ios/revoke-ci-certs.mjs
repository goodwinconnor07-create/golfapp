// Revokes the development certificates earlier CI runs made, so Xcode can make a fresh one.
// Each run on a new GitHub Mac asks Apple for a new "Created via API" development certificate,
// and Apple caps how many an account can hold. Development certificates only sign debug
// builds, so revoking them doesn't touch TestFlight or App Store builds.
//
// Needs KEY_ID, ISSUER_ID and KEY_PATH (the App Store Connect .p8 key). Run by .github/workflows/ios.yml.
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const { KEY_ID, ISSUER_ID, KEY_PATH } = process.env;
if (!KEY_ID || !ISSUER_ID || !KEY_PATH) throw new Error('KEY_ID, ISSUER_ID and KEY_PATH are needed');

const b64 = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
function token() {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })}.${b64({ iss: ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })}`;
  const key = createPrivateKey(readFileSync(KEY_PATH));
  return `${body}.${sign('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

const API = 'https://api.appstoreconnect.apple.com/v1';
const headers = { Authorization: `Bearer ${token()}` };

const res = await fetch(`${API}/certificates?filter[certificateType]=DEVELOPMENT,IOS_DEVELOPMENT&limit=200`, { headers });
if (!res.ok) throw new Error(`Listing certificates failed: ${res.status} ${await res.text()}`);
const { data } = await res.json();
// Only the ones CI made. Certificates made in Xcode on someone's Mac carry the Mac's name instead.
const ci = data.filter((c) => /Created via API/i.test(`${c.attributes.name} ${c.attributes.displayName}`));
console.log(`${data.length} development certificates, ${ci.length} made by CI`);
for (const c of ci) {
  const del = await fetch(`${API}/certificates/${c.id}`, { method: 'DELETE', headers });
  console.log(`${del.ok ? 'Revoked' : `Couldn't revoke (${del.status})`}: ${c.attributes.name} (expires ${c.attributes.expirationDate?.slice(0, 10)})`);
}
