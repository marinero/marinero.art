#!/usr/bin/env node
/**
 * Generates the APPLE_CLIENT_SECRET (a signed ES256 JWT) for Sign in with Apple.
 *
 * Apple's "client secret" is a JWT that expires after at most 6 months, so this
 * script must be re-run periodically. It has zero dependencies (uses node:crypto).
 *
 * Required inputs (env vars or CLI flags):
 *   APPLE_TEAM_ID            --team        10-char Apple Developer Team ID
 *   APPLE_KEY_ID             --key-id      10-char Key ID of the .p8 auth key
 *   APPLE_CLIENT_ID          --client-id   Services ID (e.g. art.marinero.web)
 *   APPLE_PRIVATE_KEY_PATH   --p8          Path to the AuthKey_XXXX.p8 file
 *   (or APPLE_PRIVATE_KEY with the inline PEM contents)
 *
 * Usage:
 *   APPLE_TEAM_ID=ABCDE12345 APPLE_KEY_ID=KEY123456 \
 *   APPLE_CLIENT_ID=art.marinero.web APPLE_PRIVATE_KEY_PATH=./AuthKey_KEY123456.p8 \
 *   node scripts/generate-apple-secret.mjs
 *
 *   # or with flags:
 *   node scripts/generate-apple-secret.mjs --team ABCDE12345 --key-id KEY123456 \
 *     --client-id art.marinero.web --p8 ./AuthKey_KEY123456.p8
 */
import crypto from 'node:crypto'
import fs from 'node:fs'

// Convenience: load values from ./.env.apple (gitignored) if it exists, so the
// script can be re-run with a single command. Existing env vars take priority.
function loadEnvFile(path) {
  if (!fs.existsSync(path)) return
  const content = fs.readFileSync(path, 'utf8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile(new URL('../.env.apple', import.meta.url).pathname)

function parseFlags(argv) {
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
      flags[key] = value
    }
  }
  return flags
}

const flags = parseFlags(process.argv.slice(2))

const teamId = flags.team ?? process.env.APPLE_TEAM_ID
const keyId = flags['key-id'] ?? process.env.APPLE_KEY_ID
const clientId = flags['client-id'] ?? process.env.APPLE_CLIENT_ID
const p8Path = flags.p8 ?? process.env.APPLE_PRIVATE_KEY_PATH
let privateKey = process.env.APPLE_PRIVATE_KEY

const missing = []
if (!teamId) missing.push('APPLE_TEAM_ID / --team')
if (!keyId) missing.push('APPLE_KEY_ID / --key-id')
if (!clientId) missing.push('APPLE_CLIENT_ID / --client-id')
if (!privateKey && !p8Path) missing.push('APPLE_PRIVATE_KEY_PATH / --p8 (or APPLE_PRIVATE_KEY)')

if (missing.length > 0) {
  console.error('Missing required input(s):\n  - ' + missing.join('\n  - '))
  console.error('\nRun with --help to see usage, or see comments at the top of this file.')
  process.exit(1)
}

if (!privateKey) {
  try {
    privateKey = fs.readFileSync(p8Path, 'utf8')
  } catch (error) {
    console.error(`Cannot read private key at "${p8Path}": ${error.message}`)
    process.exit(1)
  }
}

if (!privateKey.includes('BEGIN PRIVATE KEY')) {
  console.error('The provided key does not look like a PKCS#8 .p8 file (missing "BEGIN PRIVATE KEY").')
  process.exit(1)
}

const b64url = (input) => Buffer.from(input).toString('base64url')

const now = Math.floor(Date.now() / 1000)
// Apple allows up to 6 months (15777000s); use 180 days to stay safely under it.
const exp = now + 180 * 24 * 60 * 60

const header = { alg: 'ES256', kid: keyId }
const payload = {
  iss: teamId,
  iat: now,
  exp,
  aud: 'https://appleid.apple.com',
  sub: clientId,
}

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`

let signature
try {
  signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  })
} catch (error) {
  console.error(`Failed to sign the token: ${error.message}`)
  process.exit(1)
}

const jwt = `${signingInput}.${signature.toString('base64url')}`

console.error('\n✅ Apple client secret generated.')
console.error(`   Expires: ${new Date(exp * 1000).toISOString()} (regenerate before then)\n`)
console.error('Add this to your .env file:\n')
console.log(`APPLE_CLIENT_SECRET=${jwt}`)
