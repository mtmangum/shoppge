const { test } = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { create, act } = require('react-test-renderer')
const loadTs = require('./helpers/load-ts.cjs')

function setup(t, { role = 'admin', cookieBlocked = false } = {}) {
  const requests = []
  let refreshes = 0
  let cookie = ''
  const document = { documentElement: { dataset: { theme: 'system' } } }
  Object.defineProperty(document, 'cookie', {
    get: () => cookie,
    set: value => { if (!cookieBlocked) cookie = value.split(';')[0] },
  })
  const { AccountSettings } = loadTs('components/account/AccountSettings.tsx', {
    'next/navigation': { useRouter: () => ({ refresh: () => refreshes++ }) },
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
  }, {
    TextEncoder, document, window: { location: { protocol: 'https:' } },
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, ...options, data: JSON.parse(options.body), resolve, reject })),
  })
  let renderer
  const account = { name: 'Example User', email: 'user@example.com', role, department: null, phone: null, room: null }
  act(() => { renderer = create(React.createElement(AccountSettings, { account, initialTheme: 'system' })) })
  t.after(() => act(() => renderer.unmount()))
  return {
    renderer, requests, document, refreshes: () => refreshes,
    field: id => renderer.root.findByProps({ id }),
    edit(id, value) { act(() => renderer.root.findByProps({ id }).props.onChange({ target: { value } })) },
    submit: async index => act(async () => { renderer.root.findAllByType('form')[index].props.onSubmit({ preventDefault() {} }) }),
    async finish(ok, body) { await act(async () => requests.at(-1).resolve({ ok, json: async () => body })) },
    text: () => JSON.stringify(renderer.toJSON()),
  }
}

test('profile save locks fields, submits only editable details, updates the saved baseline and refreshes the name', async t => {
  const h = setup(t)
  assert.equal(h.renderer.root.findAllByType('button')[0].props.disabled, true)
  h.edit('profile-name', '  New Name  ')
  await h.submit(0)
  assert.equal(h.requests[0].url, '/api/account')
  assert.deepEqual(h.requests[0].data, { name: 'New Name', department: '', phone: '', room: '' })
  assert.equal(h.renderer.root.findAllByType('fieldset')[0].props.disabled, true)
  await h.submit(0)
  assert.equal(h.requests.length, 1)
  await h.finish(true, { profile: h.requests[0].data })
  assert.equal(h.field('profile-name').props.value, 'New Name')
  assert.equal(h.renderer.root.findAllByType('button')[0].props.disabled, true)
  assert.equal(h.refreshes(), 1)
  assert.ok(h.text().includes('Profile saved.'))
})

test('profile failure retains the draft and allows retry; a new edit clears stale success', async t => {
  const h = setup(t)
  h.edit('profile-room', '123')
  await h.submit(0)
  await h.finish(false, { error: 'Try again.' })
  assert.equal(h.field('profile-room').props.value, '123')
  assert.ok(h.text().includes('Try again.'))
  assert.equal(h.renderer.root.findAllByType('button')[0].props.disabled, false)
  await h.submit(0)
  await h.finish(true, { profile: h.requests[1].data })
  assert.ok(h.text().includes('Profile saved.'))
  h.edit('profile-room', '124')
  assert.ok(!h.text().includes('Profile saved.'))
})

test('whitespace-only names show an associated validation message without a request', async t => {
  const h = setup(t)
  h.edit('profile-name', '   ')
  await h.submit(0)
  assert.equal(h.requests.length, 0)
  assert.equal(h.field('profile-name').props['aria-invalid'], true)
  assert.equal(h.field('profile-name').props['aria-describedby'], 'profile-name-error')
})

test('password mismatch stays local; successful changes clear all password fields', async t => {
  const h = setup(t)
  h.edit('account-currentPassword', 'old-password')
  h.edit('account-newPassword', 'new-password')
  h.edit('account-confirmPassword', 'mismatched')
  await h.submit(1)
  assert.equal(h.requests.length, 0)
  assert.ok(h.text().includes('New passwords do not match.'))
  h.edit('account-confirmPassword', 'new-password')
  await h.submit(1)
  assert.deepEqual(h.requests[0].data, { currentPassword: 'old-password', newPassword: 'new-password' })
  assert.equal(h.renderer.root.findAllByType('fieldset')[2].props.disabled, true)
  await h.finish(true, { ok: true })
  for (const key of ['currentPassword', 'newPassword', 'confirmPassword']) assert.equal(h.field('account-' + key).props.value, '')
  assert.ok(h.text().includes('Password changed.'))
})

test('failed password changes retain input for retry and show the server error', async t => {
  const h = setup(t)
  h.edit('account-currentPassword', 'wrong-password')
  h.edit('account-newPassword', 'new-password')
  h.edit('account-confirmPassword', 'new-password')
  await h.submit(1)
  await h.finish(false, { error: 'Current password is incorrect.' })
  assert.equal(h.field('account-newPassword').props.value, 'new-password')
  assert.ok(h.text().includes('Current password is incorrect.'))
  assert.equal(h.renderer.root.findAllByType('fieldset')[2].props.disabled, false)
})

test('theme changes apply immediately and persist without sending account requests', t => {
  const h = setup(t)
  for (const value of ['dark', 'light', 'system']) {
    act(() => h.renderer.root.findAllByType('input').find(x => x.props.name === 'appearance' && x.props.value === value).props.onChange())
    assert.equal(h.document.documentElement.dataset.theme, value)
    assert.equal(h.document.cookie, 'shoptrack-theme=' + value)
  }
  assert.equal(h.requests.length, 0)
  assert.ok(h.text().includes('Appearance saved for this browser.'))
})

test('blocked cookies do not prevent a theme preview or claim persistence', t => {
  const h = setup(t, { cookieBlocked: true })
  act(() => h.renderer.root.findAllByType('input').find(x => x.props.name === 'appearance' && x.props.value === 'dark').props.onChange())
  assert.equal(h.document.documentElement.dataset.theme, 'dark')
  assert.ok(h.text().includes('Enable cookies to remember it next time.'))
})

test('personal settings never expose role editing and only Admins get the Users link', t => {
  for (const role of ['requestor', 'machinist', 'admin']) {
    const h = setup(t, { role })
    assert.equal(h.renderer.root.findAllByType('select').length, 0)
    const links = h.renderer.root.findAllByType('a')
    assert.equal(links.some(link => link.props.href === '/admin/users'), role === 'admin')
    assert.equal(h.renderer.root.findAllByType('input').some(input => input.props.name === 'role'), false)
  }
})
