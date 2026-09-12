const { test } = require('node:test')
const assert = require('node:assert/strict')
const { PgDialect } = require('drizzle-orm/pg-core')
const loadTs = require('./helpers/load-ts.cjs')

const profile = { name: 'Updated Name', department: 'PGE', phone: '512-555-0100', room: '101' }
const passwords = { currentPassword: 'existing-password', newPassword: 'different-password' }
function setup({ signedIn = true, exists = true, passwordMatches = true, conflict = false, failure = false } = {}) {
  const calls = { reads: [], writes: [], hashes: [], compares: [] }
  const db = {
    select: () => ({ from: () => ({ where: predicate => {
      calls.reads.push(new PgDialect().sqlToQuery(predicate))
      return { limit: async () => exists ? [{ passwordHash: 'stored-hash' }] : [] }
    } }) }),
    update: () => ({ set: data => ({ where: predicate => {
      calls.writes.push({ data, query: new PgDialect().sqlToQuery(predicate) })
      return { returning: async () => {
        if (failure) throw new Error('Sensitive database details')
        return exists && !conflict ? [{ ...profile, id: 42 }] : []
      } }
    } }) }),
  }
  const mocks = {
    '@/lib/auth': { auth: async () => signedIn ? { user: { id: '42', role: 'requestor' } } : null },
    '@/lib/db': { db },
    bcryptjs: { default: {
      compare: async (...args) => { calls.compares.push(args); return passwordMatches },
      hash: async (...args) => { calls.hashes.push(args); return 'new-hash' },
    } },
  }
  const globals = { TextEncoder }
  const profileRoute = loadTs('app/api/account/route.ts', mocks, globals)
  const passwordRoute = loadTs('app/api/account/password/route.ts', mocks, globals)
  const request = (body, contentType = 'application/json') => ({ headers: new Headers({ 'Content-Type': contentType }), json: async () => body })
  return { calls, save: (body = profile, type) => profileRoute.PATCH(request(body, type)), password: (body = passwords, type) => passwordRoute.POST(request(body, type)) }
}

test('account changes require authentication before any database or password work', async () => {
  const h = setup({ signedIn: false })
  assert.equal((await h.save()).status, 401)
  assert.equal((await h.password()).status, 401)
  assert.equal(h.calls.writes.length + h.calls.reads.length + h.calls.hashes.length, 0)
})

test('a requestor can update only their own active profile, with whitespace trimmed', async () => {
  const h = setup()
  const response = await h.save({ ...profile, name: '  Updated Name  ' })
  assert.equal(response.status, 200)
  const write = h.calls.writes[0]
  assert.equal(write.data.name, profile.name)
  assert.deepEqual(write.query.params, [42, true])
  assert.ok(write.data.updatedAt)
  assert.equal(Object.hasOwn(write.data, 'role'), false)
})

test('profile updates reject identity, permission, and password fields rather than mass assigning them', async () => {
  for (const extra of [{ id: 7 }, { role: 'admin' }, { isActive: false }, { email: 'other@example.com' }, { passwordHash: 'bad' }, { password: 'bad' }]) {
    const h = setup()
    assert.equal((await h.save({ ...profile, ...extra })).status, 400)
    assert.equal(h.calls.writes.length, 0)
  }
})

test('invalid profile fields and non-JSON requests cannot write', async () => {
  for (const body of [null, {}, { ...profile, name: ' ' }, { ...profile, room: 'x'.repeat(51) }, { ...profile, phone: 123 }]) {
    const h = setup()
    assert.equal((await h.save(body)).status, 400)
    assert.equal(h.calls.writes.length, 0)
  }
  const h = setup()
  assert.equal((await h.save(profile, 'text/plain')).status, 415)
  assert.equal((await h.password(passwords, 'text/plain')).status, 415)
  assert.equal(h.calls.writes.length + h.calls.reads.length, 0)
})

test('missing accounts and failed profile writes produce safe, actionable errors', async () => {
  assert.equal((await setup({ exists: false }).save()).status, 404)
  const response = await setup({ failure: true }).save()
  assert.equal(response.status, 500)
  assert.equal(JSON.stringify(await response.json()).includes('Sensitive'), false)
})

test('password changes verify the current password and never return hashes or credentials', async () => {
  const h = setup()
  const response = await h.password()
  assert.equal(response.status, 200)
  assert.deepEqual(h.calls.compares, [['existing-password', 'stored-hash']])
  assert.deepEqual(h.calls.hashes, [['different-password', 12]])
  assert.deepEqual(h.calls.reads[0].params, [42, true])
  assert.deepEqual(h.calls.writes[0].query.params, [42, true, 'stored-hash'])
  assert.equal(h.calls.writes[0].data.passwordHash, 'new-hash')
  assert.deepEqual(await response.json(), { ok: true })
})

test('an incorrect current password cannot trigger a hash or write', async () => {
  const h = setup({ passwordMatches: false })
  assert.equal((await h.password()).status, 400)
  assert.equal(h.calls.hashes.length + h.calls.writes.length, 0)
})

test('password validation rejects short, unchanged, oversized UTF-8, and unexpected fields', async () => {
  for (const body of [{ ...passwords, newPassword: 'short' }, { ...passwords, newPassword: passwords.currentPassword },
    { ...passwords, newPassword: 'é'.repeat(37) }, { ...passwords, userId: 7 }, { ...passwords, currentPassword: '' }]) {
    const h = setup()
    assert.equal((await h.password(body)).status, 400)
    assert.equal(h.calls.reads.length + h.calls.hashes.length + h.calls.writes.length, 0)
  }
})

test('a concurrent password/account change prevents a stale password overwrite', async () => {
  const h = setup({ conflict: true })
  assert.equal((await h.password()).status, 409)
  assert.deepEqual(h.calls.writes[0].query.params, [42, true, 'stored-hash'])
})

test('missing accounts and password database failures return safe errors', async () => {
  const h = setup({ exists: false })
  assert.equal((await h.password()).status, 404)
  assert.equal(h.calls.compares.length + h.calls.writes.length, 0)
  const response = await setup({ failure: true }).password()
  assert.equal(response.status, 500)
  assert.equal(JSON.stringify(await response.json()).includes('Sensitive'), false)
})
