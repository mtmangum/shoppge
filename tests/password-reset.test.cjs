const { test } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { PgDialect } = require('drizzle-orm/pg-core')
const loadTs = require('./helpers/load-ts.cjs')

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex')
const TOKEN = 'x'.repeat(43)
const GOOD_PASSWORD = 'a-long-enough-password'

// Fake db for lib/password-reset.ts: records writes, scripts what UPDATE ... RETURNING yields.
function setupLib({ claimable = true, userActive = true } = {}) {
  const calls = { updates: [], inserts: [], hashes: [] }
  const db = {
    update: () => ({ set: data => ({ where: predicate => {
      const query = new PgDialect().sqlToQuery(predicate)
      const call = { data, query }
      calls.updates.push(call)
      const rows = () => {
        if ('passwordHash' in data) return userActive ? [{ email: 'a@utexas.edu' }] : []
        return claimable ? [{ userId: 7 }] : []
      }
      return Object.assign(Promise.resolve(), { returning: async () => rows() })
    } }) }),
    insert: () => ({ values: async data => { calls.inserts.push(data) } }),
  }
  const lib = loadTs('lib/password-reset.ts', {
    '@/lib/db': { db },
    bcryptjs: { default: { hash: async (...args) => { calls.hashes.push(args); return 'new-hash' } } },
  })
  return { lib, calls }
}

test('only a SHA-256 of the token is stored, and older unused tokens are voided', async () => {
  const { lib, calls } = setupLib()
  const token = await lib.issuePasswordToken(7, lib.RESET_TTL_MS)
  assert.match(token, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(calls.inserts.length, 1)
  assert.equal(calls.inserts[0].tokenHash, sha256(token))
  assert.notEqual(calls.inserts[0].tokenHash, token)
  assert.equal(calls.inserts[0].userId, 7)
  const ttl = calls.inserts[0].expiresAt.getTime() - Date.now()
  assert.ok(ttl > lib.RESET_TTL_MS - 5000 && ttl <= lib.RESET_TTL_MS)
  assert.ok(calls.updates[0].data.usedAt, 'earlier tokens for the user are marked used first')
  assert.deepEqual(calls.updates[0].query.params, [7])
})

test('every issued token is different', async () => {
  const { lib } = setupLib()
  const tokens = new Set()
  for (let i = 0; i < 20; i++) tokens.add(await lib.issuePasswordToken(1, 1000))
  assert.equal(tokens.size, 20)
})

test('redeeming claims the unused, unexpired token, hashes the password and voids the rest', async () => {
  const { lib, calls } = setupLib()
  const result = await lib.redeemPasswordToken(TOKEN, GOOD_PASSWORD)
  assert.deepEqual({ ...result }, { ok: true, email: 'a@utexas.edu' })
  assert.deepEqual(calls.hashes[0], [GOOD_PASSWORD, 12])

  const claim = calls.updates[0]
  assert.match(claim.query.sql, /"token_hash" = \$1/)
  assert.match(claim.query.sql, /"used_at" is null/)
  assert.match(claim.query.sql, /"expires_at" > \$2/)
  assert.equal(claim.query.params[0], sha256(TOKEN))

  const setPassword = calls.updates[1]
  assert.equal(setPassword.data.passwordHash, 'new-hash')
  assert.match(setPassword.query.sql, /"is_active" = \$2/)
  assert.deepEqual(setPassword.query.params, [7, true])
  assert.ok(calls.updates[2].data.usedAt, 'other outstanding tokens for the user are voided')
})

test('an unknown, used or expired token changes nothing', async () => {
  const { lib, calls } = setupLib({ claimable: false })
  assert.deepEqual({ ...(await lib.redeemPasswordToken(TOKEN, GOOD_PASSWORD)) }, { ok: false })
  assert.equal(calls.updates.length, 1, 'no password update after a failed claim')
})

test('a deactivated account cannot set a password through a link', async () => {
  const { lib } = setupLib({ userActive: false })
  assert.deepEqual({ ...(await lib.redeemPasswordToken(TOKEN, GOOD_PASSWORD)) }, { ok: false })
})

const flush = () => new Promise(resolve => setImmediate(resolve))
const post = (body, ip = '10.0.0.1') => ({
  headers: new Headers({ 'x-forwarded-for': ip }),
  json: async () => body,
})

function setupRequestRoute({ user = { id: 7, name: 'A', email: 'a@utexas.edu' }, mailFails = false } = {}) {
  const sent = [], issued = []
  const db = { select: () => ({ from: () => ({ where: () => ({ limit: async () => (user ? [user] : []) }) }) }) }
  const route = loadTs('app/api/password-reset/request/route.ts', {
    '@/lib/db': { db },
    '@/lib/mail': { sendPasswordLinkEmail: async params => { sent.push(params); if (mailFails) throw new Error('smtp down') } },
    '@/lib/password-reset': {
      RESET_TTL_MS: 3600000,
      issuePasswordToken: async (id, ttl) => { issued.push({ id, ttl }); return 'TOKEN-VALUE' },
    },
  })
  return { route, sent, issued }
}

test('a reset request for a real account emails a one-hour link', async () => {
  const h = setupRequestRoute()
  const response = await h.route.POST(post({ email: 'a@utexas.edu' }))
  assert.equal(response.status, 200)
  await flush()
  assert.deepEqual(h.issued, [{ id: 7, ttl: 3600000 }])
  assert.equal(h.sent.length, 1)
  assert.deepEqual({ ...h.sent[0] }, { to: 'a@utexas.edu', name: 'A', token: 'TOKEN-VALUE', kind: 'reset' })
})

test('the response is identical for unknown accounts and mail failures, and nothing is sent', async () => {
  const known = await setupRequestRoute().route.POST(post({ email: 'a@utexas.edu' }))
  const none = setupRequestRoute({ user: null })
  const unknown = await none.route.POST(post({ email: 'nobody@utexas.edu' }))
  await flush()
  assert.equal(none.sent.length, 0)
  assert.equal(unknown.status, known.status)
  assert.deepEqual(await unknown.json(), await known.json())

  const failing = setupRequestRoute({ mailFails: true })
  const failed = await failing.route.POST(post({ email: 'a@utexas.edu' }))
  await flush()
  assert.equal(failed.status, 200)
})

test('requests are limited to three per email per hour, still answering the same way', async () => {
  const h = setupRequestRoute()
  for (let i = 0; i < 5; i++) {
    const response = await h.route.POST(post({ email: 'A@UTexas.edu' }, `10.0.1.${i}`))
    assert.equal(response.status, 200)
  }
  await flush()
  assert.equal(h.sent.length, 3)
})

test('requests are limited to ten per IP per hour', async () => {
  const h = setupRequestRoute()
  for (let i = 0; i < 12; i++) await h.route.POST(post({ email: `u${i}@utexas.edu` }, '10.0.2.1'))
  await flush()
  assert.equal(h.sent.length, 10)
})

test('a malformed request body is rejected', async () => {
  const h = setupRequestRoute()
  assert.equal((await h.route.POST(post({ email: 'not-an-email' }))).status, 400)
  assert.equal((await h.route.POST(post(null))).status, 400)
  assert.equal((await h.route.POST(post({ email: 'a@utexas.edu', extra: 1 }))).status, 400)
})

function setupConfirmRoute({ result = { ok: true, email: 'a@utexas.edu' } } = {}) {
  const redeemed = [], cleared = []
  const loginThrottle = loadTs('lib/login-throttle.ts')
  const route = loadTs('app/api/password-reset/confirm/route.ts', {
    '@/lib/password-reset': { redeemPasswordToken: async (token, password) => { redeemed.push({ token, password }); return result } },
    '@/lib/login-throttle': { clearLoginFailures: email => { cleared.push(email); loginThrottle.clearLoginFailures(email) } },
  }, { TextEncoder })
  return { route, redeemed, cleared }
}

test('a valid link and strong password set the password and clear the login lockout', async () => {
  const h = setupConfirmRoute()
  const response = await h.route.POST(post({ token: TOKEN, password: GOOD_PASSWORD }))
  assert.equal(response.status, 200)
  assert.deepEqual(h.redeemed, [{ token: TOKEN, password: GOOD_PASSWORD }])
  assert.deepEqual(h.cleared, ['a@utexas.edu'])
})

test('passwords under 12 characters or over 72 bytes are rejected before the token is touched', async () => {
  const h = setupConfirmRoute()
  for (const password of ['short-11-ch', 'x'.repeat(73), 'é'.repeat(37)]) {
    const response = await h.route.POST(post({ token: TOKEN, password }))
    assert.equal(response.status, 400)
  }
  assert.equal(h.redeemed.length, 0)
})

test('an invalid or expired link gets a generic 400 and clears no lockout', async () => {
  const h = setupConfirmRoute({ result: { ok: false } })
  const response = await h.route.POST(post({ token: TOKEN, password: GOOD_PASSWORD }))
  assert.equal(response.status, 400)
  assert.match((await response.json()).error, /invalid or has expired/)
  assert.equal(h.cleared.length, 0)
})

test('confirm attempts are limited to twenty per IP per 15 minutes', async () => {
  const h = setupConfirmRoute({ result: { ok: false } })
  for (let i = 0; i < 20; i++) assert.equal((await h.route.POST(post({ token: TOKEN, password: GOOD_PASSWORD }, '10.0.3.1'))).status, 400)
  assert.equal((await h.route.POST(post({ token: TOKEN, password: GOOD_PASSWORD }, '10.0.3.1'))).status, 429)
  assert.equal((await h.route.POST(post({ token: TOKEN, password: GOOD_PASSWORD }, '10.0.3.2'))).status, 400)
})
