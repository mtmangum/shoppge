const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./helpers/load-ts.cjs')

const GOOD_HASH = 'stored-hash'

// Loads the real lib/auth.ts and returns the credentials provider's authorize().
function setup({ user } = {}) {
  const compared = []
  let config
  loadTs('lib/auth.ts', {
    'next-auth': { default: c => { config = c; return { handlers: {}, signIn() {}, signOut() {}, auth() {} } } },
    'next-auth/providers/credentials': { default: c => c },
    bcryptjs: {
      default: {
        compare: async (password, hash) => { compared.push(hash); return password === 'right' && hash === GOOD_HASH },
        hashSync: () => 'dummy-hash',
      },
    },
    './db': { db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => (user ? [user] : []) }) }) }) } },
    './login-throttle': loadTs('lib/login-throttle.ts'),
    './schema': { users: {} },
    'drizzle-orm': { eq: () => null },
  })
  const authorize = config.providers[0].authorize
  const request = ip => ({ headers: { get: name => (name === 'x-forwarded-for' ? ip : null) } })
  return { authorize, request, compared }
}

const activeUser = { id: 7, email: 'a@utexas.edu', name: 'A', role: 'requestor', isActive: true, passwordHash: GOOD_HASH }

test('correct credentials sign in', async () => {
  const { authorize, request } = setup({ user: activeUser })
  const result = await authorize({ email: 'ok@utexas.edu', password: 'right' }, request('10.0.0.1'))
  assert.deepEqual({ ...result }, { id: '7', email: 'a@utexas.edu', name: 'A', role: 'requestor' })
})

test('five wrong passwords lock the email, even for the right password and another IP', async () => {
  const { authorize, request } = setup({ user: activeUser })
  for (let i = 0; i < 5; i++) {
    assert.equal(await authorize({ email: 'lock@utexas.edu', password: 'wrong' }, request('10.0.0.2')), null)
  }
  assert.equal(await authorize({ email: 'lock@utexas.edu', password: 'right' }, request('10.0.0.2')), null)
  assert.equal(await authorize({ email: 'lock@utexas.edu', password: 'right' }, request('10.0.0.3')), null)
})

test('a successful sign-in resets the failure count', async () => {
  const { authorize, request } = setup({ user: activeUser })
  for (let i = 0; i < 4; i++) await authorize({ email: 'reset@utexas.edu', password: 'wrong' }, request('10.0.0.4'))
  assert.ok(await authorize({ email: 'reset@utexas.edu', password: 'right' }, request('10.0.0.4')))
  for (let i = 0; i < 4; i++) await authorize({ email: 'reset@utexas.edu', password: 'wrong' }, request('10.0.0.4'))
  assert.ok(await authorize({ email: 'reset@utexas.edu', password: 'right' }, request('10.0.0.4')))
})

test('unknown, inactive and passwordless accounts still run a password comparison and fail', async () => {
  for (const user of [undefined, { ...activeUser, isActive: false }, { ...activeUser, passwordHash: null }]) {
    const { authorize, request, compared } = setup({ user })
    assert.equal(await authorize({ email: 'x@utexas.edu', password: 'right' }, request('10.0.0.5')), null)
    assert.equal(compared.length, 1, 'bcrypt.compare must run so timing matches a real account')
    assert.equal(compared[0], 'dummy-hash')
  }
})

test('blocked callers are rejected before any database or bcrypt work', async () => {
  const { authorize, request, compared } = setup({ user: activeUser })
  for (let i = 0; i < 5; i++) await authorize({ email: 'busy@utexas.edu', password: 'wrong' }, request('10.0.0.6'))
  compared.length = 0
  assert.equal(await authorize({ email: 'busy@utexas.edu', password: 'right' }, request('10.0.0.6')), null)
  assert.equal(compared.length, 0)
})
