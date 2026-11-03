// Checks, with the deploy service account's own key, that it can do everything
// the deploy needs, and prints exactly which permissions or APIs are missing.
// Prints only the account email, project, permission names and API names.
import { createSign } from 'node:crypto'

const fail = (m) => { console.log(`::error::${m}`); process.exitCode = 1 }
const raw = process.env.FIREBASE_SERVICE_ACCOUNT || ''
const project = process.env.FIREBASE_PROJECT_ID || ''
if (!raw.trim()) { fail('FIREBASE_SERVICE_ACCOUNT is empty or missing.'); process.exit(1) }
if (!project) { fail('FIREBASE_PROJECT_ID is empty or missing.'); process.exit(1) }
let sa
try { sa = JSON.parse(raw) } catch {
  fail(`FIREBASE_SERVICE_ACCOUNT is not valid JSON (${raw.length} characters). Paste the whole key file, from the first { to the last }.`)
  process.exit(1)
}
if (sa.type !== 'service_account' || !sa.client_email || !sa.private_key?.includes('BEGIN PRIVATE KEY')) {
  fail('FIREBASE_SERVICE_ACCOUNT is not a complete service account key file.'); process.exit(1)
}
console.log(`Service account: ${sa.client_email}`)
console.log(`Key project: ${sa.project_id} / deploy project: ${project}`)

const b64 = (s) => Buffer.from(s).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
const claims = b64(JSON.stringify({
  iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform',
  aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600,
}))
const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(sa.private_key, 'base64url')
const tok = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${sig}` }),
}).then((r) => r.json())
if (!tok.access_token) { fail(`Google rejected the key (${tok.error ?? 'unknown error'}). Create a new JSON key and update the secret.`); process.exit(1) }
const auth = { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }

// Permissions used by: firestore rules, firestore indexes, database rules, hosting.
const needed = {
  'firebaserules.rulesets.test': 'Firebase Rules Admin (or Firebase Admin)',
  'firebaserules.rulesets.create': 'Firebase Rules Admin (or Firebase Admin)',
  'firebaserules.releases.update': 'Firebase Rules Admin (or Firebase Admin)',
  'datastore.indexes.create': 'Cloud Datastore Index Admin (or Firebase Admin)',
  'datastore.indexes.list': 'Cloud Datastore Index Admin (or Firebase Admin)',
  'firebasedatabase.instances.update': 'Firebase Realtime Database Admin (or Firebase Admin)',
  'firebasehosting.sites.update': 'Firebase Hosting Admin (or Firebase Admin)',
  'serviceusage.services.get': 'Service Usage Viewer',
  'serviceusage.services.use': 'Service Usage Consumer',
}
const iam = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:testIamPermissions`, {
  method: 'POST', headers: auth, body: JSON.stringify({ permissions: Object.keys(needed) }),
}).then((r) => r.json())
if (iam.error) {
  console.log(`::warning::Could not check permissions on project ${project}: ${iam.error.message}`)
} else {
  const have = new Set(iam.permissions ?? [])
  const missing = Object.keys(needed).filter((p) => !have.has(p))
  for (const p of missing) fail(`Missing permission ${p}: add the role ${needed[p]} to ${sa.client_email}.`)
  if (!missing.length) console.log('All deploy permissions present.')
}

// APIs the deploy calls.
for (const api of ['firebaserules.googleapis.com', 'firestore.googleapis.com', 'firebasedatabase.googleapis.com', 'firebasehosting.googleapis.com']) {
  const s = await fetch(`https://serviceusage.googleapis.com/v1/projects/${project}/services/${api}`, { headers: auth }).then((r) => r.json())
  if (s.error) console.log(`Could not check ${api}: ${s.error.message}`)
  else if (s.state !== 'ENABLED') fail(`API ${api} is turned off. Enable it: https://console.cloud.google.com/apis/library/${api}?project=${project}`)
  else console.log(`API ${api}: enabled`)
}
