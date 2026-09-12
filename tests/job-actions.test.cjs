const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { create, act } = require('react-test-renderer')

const root = path.join(__dirname, '..')
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'components/jobs/JobActions.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
}).outputText

// Real @/lib/* modules the component imports at runtime (not just as
// `import type`) get loaded and transpiled the same way — a plain
// `require('@/...')` would otherwise hit real Node module resolution and
// throw, since that alias only exists via tsconfig/webpack, not Node.
const moduleCache = new Map()
function loadModule(relPath) {
  const resolved = path.resolve(root, relPath)
  if (moduleCache.has(resolved)) return moduleCache.get(resolved)
  const exports = {}
  moduleCache.set(resolved, exports)
  const modCompiled = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText
  vm.runInNewContext(modCompiled, { exports, require: id => id.startsWith('@/') ? loadModule(id.slice(2) + '.ts') : require(id) })
  return exports
}

function setup(t, overrides = {}) {
  const requests = []
  let refreshes = 0
  let confirmed = true
  const destinations = []
  const exports = {}
  vm.runInNewContext(compiled, {
    exports,
    require: id => id === 'next/navigation'
      ? { useRouter: () => ({ refresh: () => refreshes++, push: url => destinations.push(url) }) }
      : id.startsWith('@/') ? loadModule(id.slice(2) + '.ts') : require(id),
    window: { confirm: () => confirmed },
    fetch: (url, options) => new Promise((resolve, reject) => requests.push({
      url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined, resolve, reject,
    })),
  })
  let renderer
  let props = {
    jobId: 42, status: 'pending', machinistId: 7, currentUserId: 7,
    materialsRequired: false, materialsOrdered: false, machinistNotes: '',
    machinists: [{ id: 7, name: 'First machinist' }, { id: 8, name: 'Second machinist' }], isAdmin: false, ...overrides,
  }
  act(() => { renderer = create(React.createElement(exports.JobActions, props)) })
  t.after(() => act(() => renderer.unmount()))
  return {
    renderer, requests, destinations,
    commit(next) { props = { ...props, ...next }; act(() => renderer.update(React.createElement(exports.JobActions, props))) },
    confirm: value => { confirmed = value },
    refreshes: () => refreshes,
    field: id => renderer.root.findByProps({ id }),
    statusButton: () => renderer.root.findAllByType('button')[0],
    async failNetwork() { await act(async () => requests.at(-1).reject(new Error('Network unavailable'))) },
    async finish(ok = true) {
      await act(async () => requests.at(-1).resolve({ ok, json: async () => ({ error: 'Save failed' }) }))
    },
  }
}

test('a changed status enables Update Status and returning to the saved status disables it', t => {
  const h = setup(t)
  assert.equal(h.statusButton().props.disabled, true)
  act(() => h.field('job-status').props.onChange({ target: { value: 'inprogress' } }))
  assert.equal(h.statusButton().props.disabled, false)
  act(() => h.field('job-status').props.onChange({ target: { value: 'pending' } }))
  assert.equal(h.statusButton().props.disabled, true)
})

test('assignment saves immediately without submitting a status change', async t => {
  const h = setup(t)
  act(() => { h.field('job-assigned-machinist').props.onChange({ target: { value: '8' } }) })
  assert.deepEqual(h.requests[0].body, { machinistId: 8 })
  assert.equal(h.requests[0].url, '/api/jobs/42')
  assert.equal(h.field('job-assigned-machinist').props.disabled, true)
  await h.finish()
  assert.equal(h.field('job-assigned-machinist').props.value, '8')
  assert.equal(h.field('job-assigned-machinist').props.disabled, false)
  assert.equal(h.statusButton().props.disabled, true)
  assert.equal(h.refreshes(), 1)
})

test('failed automatic assignment restores the previous machinist and exposes the error', async t => {
  const h = setup(t)
  act(() => { h.field('job-assigned-machinist').props.onChange({ target: { value: '8' } }) })
  await h.finish(false)
  assert.equal(h.field('job-assigned-machinist').props.value, '7')
  assert.equal(h.renderer.root.findByProps({ role: 'alert' }).children[0], 'Save failed')
  assert.equal(h.refreshes(), 0)
})

test('material toggles save immediately and roll back a failed save', async t => {
  const h = setup(t)
  const checkbox = () => h.renderer.root.findAllByProps({ type: 'checkbox' })[0]
  act(() => { checkbox().props.onChange({ target: { checked: true } }) })
  assert.deepEqual(h.requests[0].body, { materialsRequired: true })
  assert.equal(checkbox().props.disabled, true)
  await h.finish(false)
  assert.equal(checkbox().props.checked, false)
  assert.equal(checkbox().props.disabled, false)
  assert.equal(h.statusButton().props.disabled, true)
})


test('status save sends the selected status/note and prevents a second submission before refresh', async t => {
  const h = setup(t)
  const note = () => h.renderer.root.findByProps({ 'aria-label': 'Optional note about this status change' })
  act(() => h.field('job-status').props.onChange({ target: { value: 'inprogress' } }))
  act(() => note().props.onChange({ target: { value: 'Starting work' } }))
  act(() => { h.renderer.root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} }) })
  assert.equal(h.requests[0].url, '/api/jobs/42/status')
  assert.deepEqual(h.requests[0].body, { status: 'inprogress', note: 'Starting work' })
  assert.equal(h.statusButton().props.disabled, true)
  await h.finish()
  assert.equal(note().props.value, '')
  assert.equal(h.statusButton().props.disabled, true)
  assert.equal(h.refreshes(), 1)
})

test('status controls cannot change during an in-flight save', async t => {
  const h = setup(t)
  act(() => h.field('job-status').props.onChange({ target: { value: 'completed' } }))
  act(() => { h.renderer.root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} }) })
  assert.equal(h.field('job-status').props.disabled, true)
  assert.equal(h.renderer.root.findByProps({ 'aria-label': 'Optional note about this status change' }).props.disabled, true)
  await h.finish()
})

test('failed status save preserves the draft and allows retry', async t => {
  const h = setup(t)
  const note = () => h.renderer.root.findByProps({ 'aria-label': 'Optional note about this status change' })
  act(() => h.field('job-status').props.onChange({ target: { value: 'inprogress' } }))
  act(() => note().props.onChange({ target: { value: 'Keep this note' } }))
  act(() => { h.renderer.root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} }) })
  await h.failNetwork()
  assert.equal(h.field('job-status').props.value, 'inprogress')
  assert.equal(note().props.value, 'Keep this note')
  assert.equal(h.statusButton().props.disabled, false)
  assert.equal(h.renderer.root.findByProps({ role: 'alert' }).children[0], 'Network unavailable')
  assert.equal(h.refreshes(), 0)
})

test('notes save independently and disable duplicate saves before refresh', async t => {
  const h = setup(t)
  act(() => h.field('job-machinist-notes').props.onChange({ target: { value: 'Use aluminum' } }))
  act(() => { h.renderer.root.findAllByType('form')[1].props.onSubmit({ preventDefault() {} }) })
  assert.deepEqual(h.requests[0].body, { machinistNotes: 'Use aluminum' })
  await h.finish()
  assert.equal(h.renderer.root.findAllByType('button')[1].props.disabled, true)
  assert.equal(h.statusButton().props.disabled, true)
  act(() => h.field('job-machinist-notes').props.onChange({ target: { value: 'Use steel' } }))
  assert.equal(h.renderer.root.findAllByType('button')[1].props.disabled, false)
})

test('failed notes save keeps the draft for retry', async t => {
  const h = setup(t)
  act(() => h.field('job-machinist-notes').props.onChange({ target: { value: 'Keep these notes' } }))
  act(() => { h.renderer.root.findAllByType('form')[1].props.onSubmit({ preventDefault() {} }) })
  await h.finish(false)
  assert.equal(h.field('job-machinist-notes').props.value, 'Keep these notes')
  assert.equal(h.renderer.root.findAllByType('button')[1].props.disabled, false)
  assert.equal(h.refreshes(), 0)
})

test('unassigning sends null and material changes persist on success', async t => {
  const h = setup(t)
  act(() => { h.field('job-assigned-machinist').props.onChange({ target: { value: '' } }) })
  assert.deepEqual(h.requests[0].body, { machinistId: null })
  await h.finish()
  const ordered = () => h.renderer.root.findAllByProps({ type: 'checkbox' })[1]
  act(() => { ordered().props.onChange({ target: { checked: true } }) })
  assert.deepEqual(h.requests[1].body, { materialsOrdered: true })
  await h.finish()
  assert.equal(ordered().props.checked, true)
  assert.equal(h.refreshes(), 2)
})

test('job deletion is hidden for non-admins', t => {
  const h = setup(t)
  assert.equal(h.renderer.root.findAllByType('button').some(b => b.children.includes('Delete Job')), false)
})

test('admin deletion requires confirmation and navigates only on success', async t => {
  const h = setup(t, { isAdmin: true })
  const button = () => h.renderer.root.findAllByType('button').at(-1)
  h.confirm(false)
  await act(async () => button().props.onClick())
  assert.equal(h.requests.length, 0)
  h.confirm(true)
  act(() => { button().props.onClick() })
  assert.equal(h.requests[0].method, 'DELETE')
  assert.equal(button().props.disabled, true)
  await h.finish(false)
  assert.equal(button().props.disabled, false)
  assert.equal(h.destinations.length, 0)
  act(() => { button().props.onClick() })
  await h.finish()
  assert.deepEqual(h.destinations, ['/jobs'])
})


test('server refresh updates clean fields while preserving unsaved drafts', t => {
  const h = setup(t)
  h.commit({ status: 'inprogress', machinistNotes: 'Server notes' })
  assert.equal(h.field('job-status').props.value, 'inprogress')
  assert.equal(h.statusButton().props.disabled, true)
  assert.equal(h.field('job-machinist-notes').props.value, 'Server notes')
  act(() => h.field('job-status').props.onChange({ target: { value: 'completed' } }))
  act(() => h.field('job-machinist-notes').props.onChange({ target: { value: 'Unsaved draft' } }))
  h.commit({ status: 'cancelled', machinistNotes: 'Newer server notes' })
  assert.equal(h.field('job-status').props.value, 'completed')
  assert.equal(h.field('job-machinist-notes').props.value, 'Unsaved draft')
  assert.equal(h.statusButton().props.disabled, false)
})

test('the response to an earlier save does not replace a newer notes draft', async t => {
  const h = setup(t)
  act(() => h.field('job-machinist-notes').props.onChange({ target: { value: 'First save' } }))
  act(() => { h.renderer.root.findAllByType('form')[1].props.onSubmit({ preventDefault() {} }) })
  assert.equal(h.field('job-machinist-notes').props.disabled, true)
  await h.finish()
  act(() => h.field('job-machinist-notes').props.onChange({ target: { value: 'Second draft' } }))
  h.commit({ machinistNotes: 'First save' })
  assert.equal(h.field('job-machinist-notes').props.value, 'Second draft')
  assert.equal(h.renderer.root.findAllByType('button')[1].props.disabled, false)
})

test('assignment autosave has visible saving and success feedback', async t => {
  const h = setup(t)
  const feedback = () => h.renderer.root.findByProps({ id: 'job-assignment-save-status' }).children[0]
  assert.equal(feedback(), 'Saves automatically.')
  act(() => { h.field('job-assigned-machinist').props.onChange({ target: { value: '8' } }) })
  assert.equal(feedback(), 'Saving assignment…')
  await h.finish()
  assert.equal(feedback(), 'Assignment saved.')
})
