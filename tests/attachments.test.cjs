const { test } = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { create, act } = require('react-test-renderer')
const loadTs = require('./helpers/load-ts.cjs')

function setup(t, canDelete = true) {
  const requests = []
  let refreshes = 0
  const input = { files: [], value: '' }
  const { AttachmentsPanel } = loadTs('components/AttachmentsPanel.tsx', {
    'next/navigation': { useRouter: () => ({ refresh: () => refreshes++ }) },
  }, {
    fetch: (url, options) => new Promise(resolve => requests.push({ url, ...options, resolve })),
  })
  let renderer
  act(() => { renderer = create(React.createElement(AttachmentsPanel, {
    jobId: 42, canDelete,
    attachments: [{ id: 5, originalName: 'part.pdf', fileSizeBytes: 1024 }, { id: 6, originalName: 'plan.png', fileSizeBytes: 4096 }],
  }), { createNodeMock: element => element.type === 'input' ? input : null }) })
  t.after(() => act(() => renderer.unmount()))
  return {
    renderer, requests, input,
    refreshes: () => refreshes,
    upload() { act(() => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }) }) },
    remove() { act(() => { renderer.root.findByProps({ 'aria-label': 'Delete part.pdf' }).props.onClick() }) },
    async finish(ok = true) { await act(async () => requests.at(-1).resolve({ ok, json: async () => ({ error: 'Storage unavailable' }) })) },
  }
}

test('upload with no selected file makes no request', t => {
  const h = setup(t)
  h.upload()
  assert.equal(h.requests.length, 0)
})

test('upload sends the file and clears it only after success', async t => {
  const h = setup(t)
  h.input.files = [new File(['drawing'], 'part.pdf', { type: 'application/pdf' })]
  h.input.value = 'part.pdf'
  h.upload()
  assert.equal(h.requests[0].url, '/api/jobs/42/attachments')
  assert.equal(h.requests[0].method, 'POST')
  assert.equal(h.requests[0].body.get('file').name, 'part.pdf')
  assert.equal(h.renderer.root.findByProps({ type: 'submit' }).props.disabled, true)
  await h.finish()
  assert.equal(h.input.value, '')
  assert.equal(h.refreshes(), 1)
})

test('failed uploads keep the file for retry and expose an alert', async t => {
  const h = setup(t)
  h.input.files = [new File(['drawing'], 'part.pdf', { type: 'application/pdf' })]
  h.input.value = 'part.pdf'
  h.upload()
  await h.finish(false)
  assert.equal(h.input.value, 'part.pdf')
  assert.equal(h.renderer.root.findByProps({ role: 'alert' }).children[0], 'Storage unavailable')
  assert.equal(h.refreshes(), 0)
})

test('attachment links identify both the job and attachment; delete is hidden without permission', t => {
  const h = setup(t, false)
  assert.equal(h.renderer.root.findAllByType('a')[0].props.href, '/api/jobs/42/attachments/5')
  assert.equal(h.renderer.root.findAllByProps({ 'aria-label': 'Delete part.pdf' }).length, 0)
})

test('retrying a failed delete clears the old error after success', async t => {
  const h = setup(t)
  h.remove()
  assert.equal(h.requests[0].method, 'DELETE')
  assert.equal(h.requests[0].url, '/api/jobs/42/attachments/5')
  await h.finish(false)
  assert.equal(h.renderer.root.findAllByProps({ role: 'alert' }).length, 1)
  h.remove()
  await h.finish()
  assert.equal(h.renderer.root.findAllByProps({ role: 'alert' }).length, 0)
  assert.equal(h.refreshes(), 1)
})

test('an attachment delete locks other deletes until the request completes', async t => {
  const h = setup(t)
  h.remove()
  assert.equal(h.renderer.root.findByProps({ 'aria-label': 'Delete plan.png' }).props.disabled, true)
  await h.finish()
  assert.equal(h.renderer.root.findByProps({ 'aria-label': 'Delete plan.png' }).props.disabled, false)
})
