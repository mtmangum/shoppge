const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./helpers/load-ts.cjs')

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const globals = { TextEncoder }
const json = body => ({ headers: new Headers(), json: async () => body })

// Scripted fake db: select().from().where().limit() pops the next prepared result.
function setup({ selects = [], mailFails = false } = {}) {
  const calls = { inserts: [], updates: [], sent: [], tokens: [], hashes: [] }
  const queue = [...selects]
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => queue.shift() ?? [] }) }) }),
    insert: () => ({ values: data => {
      calls.inserts.push(data)
      return Object.assign(Promise.resolve(), { returning: async () => [{ id: 9, ...data }] })
    } }),
    update: () => ({ set: data => ({ where: async () => { calls.updates.push(data) } }) }),
  }
  const mocks = {
    '@/lib/db': { db },
    '@/lib/auth': { requireAdmin: async () => ({ id: '1', role: 'admin' }) },
    '@/lib/mail': { sendPasswordLinkEmail: async params => { calls.sent.push(params); if (mailFails) throw new Error('smtp down') } },
    '@/lib/password-reset': {
      INVITE_TTL_MS,
      issuePasswordToken: async (id, ttl) => { calls.tokens.push({ id, ttl }); return 'TOKEN-VALUE' },
    },
    bcryptjs: { default: { hash: async (...args) => { calls.hashes.push(args); return 'hashed' } } },
  }
  return { calls, load: file => loadTs(file, mocks, globals) }
}

const request = { id: 3, name: 'New Person', email: 'new@utexas.edu', department: 'PGE', phone: null, status: 'pending' }
const PATCH = (route, body) => route.PATCH(json(body), { params: { id: '3' } })

test('the public access-request form answers the same for new, registered and already-pending emails', async () => {
  const body = { name: 'N', email: 'new@utexas.edu' }
  const fresh = setup({ selects: [[], []] })
  const registered = setup({ selects: [[{ id: 1 }]] })
  const pending = setup({ selects: [[], [{ id: 2 }]] })

  const responses = []
  for (const h of [fresh, registered, pending]) {
    const response = await h.load('app/api/access-requests/route.ts').POST(json(body))
    responses.push({ status: response.status, body: await response.json() })
  }
  assert.deepEqual(responses[1], responses[0])
  assert.deepEqual(responses[2], responses[0])
  assert.equal(responses[0].status, 201)
  assert.equal(fresh.calls.inserts.length, 1)
  assert.equal(registered.calls.inserts.length, 0)
  assert.equal(pending.calls.inserts.length, 0)
})

test('approving without a password creates the user and emails a seven-day set-password link', async () => {
  const h = setup({ selects: [[request], []] })
  const response = await PATCH(h.load('app/api/access-requests/[id]/route.ts'), { decision: 'approved', role: 'requestor' })
  assert.deepEqual(await response.json(), { ok: true, inviteSent: true })
  assert.equal(h.calls.inserts[0].passwordHash, null)
  assert.deepEqual(h.calls.tokens, [{ id: 9, ttl: INVITE_TTL_MS }])
  assert.deepEqual({ ...h.calls.sent[0] }, { to: 'new@utexas.edu', name: 'New Person', token: 'TOKEN-VALUE', kind: 'invite' })
})

test('approving with an admin-set password sends no email', async () => {
  const h = setup({ selects: [[request], []] })
  const response = await PATCH(h.load('app/api/access-requests/[id]/route.ts'), { decision: 'approved', password: 'a-long-enough-password' })
  assert.deepEqual(await response.json(), { ok: true })
  assert.equal(h.calls.inserts[0].passwordHash, 'hashed')
  assert.equal(h.calls.sent.length + h.calls.tokens.length, 0)
})

test('rejecting never creates a user or sends mail', async () => {
  const h = setup({ selects: [[request]] })
  const response = await PATCH(h.load('app/api/access-requests/[id]/route.ts'), { decision: 'rejected' })
  assert.equal(response.status, 200)
  assert.equal(h.calls.inserts.length + h.calls.sent.length, 0)
})

test('a failed set-password email still approves the request and tells the admin', async () => {
  const h = setup({ selects: [[request], []], mailFails: true })
  const response = await PATCH(h.load('app/api/access-requests/[id]/route.ts'), { decision: 'approved' })
  assert.deepEqual(await response.json(), { ok: true, inviteSent: false })
  assert.equal(h.calls.updates.at(-1).status, 'approved')
})

test('admin-created users with no password get an invite; with a password they do not', async () => {
  const withoutPassword = setup()
  const created = await withoutPassword.load('app/api/users/route.ts').POST(json({ name: 'U', email: 'u@utexas.edu' }))
  assert.equal(created.status, 201)
  assert.equal((await created.json()).inviteSent, true)
  assert.equal(withoutPassword.calls.sent[0].kind, 'invite')
  assert.equal(withoutPassword.calls.sent[0].to, 'u@utexas.edu')

  const withPassword = setup()
  const direct = await withPassword.load('app/api/users/route.ts').POST(json({ name: 'U', email: 'u@utexas.edu', password: 'a-long-enough-password' }))
  assert.equal(direct.status, 201)
  assert.equal(withPassword.calls.sent.length, 0)
})

test('admin-set passwords must meet the 12-character rule', async () => {
  const h = setup()
  const response = await h.load('app/api/users/route.ts').POST(json({ name: 'U', email: 'u@utexas.edu', password: 'short-11-ch' }))
  assert.equal(response.status, 400)
  assert.equal(h.calls.inserts.length, 0)
})
