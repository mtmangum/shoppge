const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./helpers/load-ts.cjs')

const throttle = () => loadTs('lib/login-throttle.ts')
const headers = map => ({ get: name => map[name] ?? null })

test('an email is blocked after five failures and recovers once the window passes', () => {
  const t = throttle()
  const start = 1_000_000
  for (let i = 0; i < 4; i++) t.recordLoginFailure('a@utexas.edu', '1.1.1.1', start + i)
  assert.equal(t.isLoginBlocked('a@utexas.edu', '1.1.1.1', start + 10), false)
  t.recordLoginFailure('a@utexas.edu', '1.1.1.1', start + 5)
  assert.equal(t.isLoginBlocked('a@utexas.edu', '1.1.1.1', start + 10), true)
  assert.equal(t.isLoginBlocked('a@utexas.edu', '9.9.9.9', start + 10), true, 'blocked from any IP')
  assert.equal(t.isLoginBlocked('b@utexas.edu', '9.9.9.9', start + 10), false, 'other emails unaffected')
  assert.equal(t.isLoginBlocked('a@utexas.edu', '1.1.1.1', start + t.WINDOW_MS + 6), false)
})

test('email matching ignores case and surrounding spaces', () => {
  const t = throttle()
  for (let i = 0; i < 5; i++) t.recordLoginFailure(' A@UTexas.edu ', '1.1.1.1', i)
  assert.equal(t.isLoginBlocked('a@utexas.edu', '2.2.2.2', 10), true)
})

test('an IP is blocked after thirty failures across different emails', () => {
  const t = throttle()
  for (let i = 0; i < 29; i++) t.recordLoginFailure(`u${i}@utexas.edu`, '3.3.3.3', i)
  assert.equal(t.isLoginBlocked('fresh@utexas.edu', '3.3.3.3', 100), false)
  t.recordLoginFailure('u30@utexas.edu', '3.3.3.3', 30)
  assert.equal(t.isLoginBlocked('fresh@utexas.edu', '3.3.3.3', 100), true)
  assert.equal(t.isLoginBlocked('fresh@utexas.edu', '4.4.4.4', 100), false)
})

test('a successful login clears the email counter but not the IP counter', () => {
  const t = throttle()
  for (let i = 0; i < 4; i++) t.recordLoginFailure('a@utexas.edu', '1.1.1.1', i)
  t.recordLoginSuccess('a@utexas.edu')
  t.recordLoginFailure('a@utexas.edu', '1.1.1.1', 10)
  assert.equal(t.isLoginBlocked('a@utexas.edu', '1.1.1.1', 20), false)
})

test('client IP comes from the first X-Forwarded-For hop, then X-Real-IP', () => {
  const t = throttle()
  assert.equal(t.clientIp(headers({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' })), '203.0.113.7')
  assert.equal(t.clientIp(headers({ 'x-real-ip': '198.51.100.2' })), '198.51.100.2')
  assert.equal(t.clientIp(headers({})), 'unknown')
  assert.equal(t.clientIp(undefined), 'unknown')
})
