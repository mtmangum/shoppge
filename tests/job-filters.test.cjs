const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { create, act } = require('react-test-renderer')

// Exercise the real component/hooks. Only the Next router and debounce clock
// are controlled here, so response commits can arrive between keystrokes.
const root = path.join(__dirname, '..')
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'components/jobs/JobFilters.tsx'), 'utf8'), {
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

function setup(t, initialQuery = '') {
  let query = initialQuery
  let now = 0
  let nextTimer = 0
  let focuses = 0
  const timers = new Map()
  const navigations = []
  const router = { replace: (href, options) => navigations.push({ href, options }) }
  const exports = {}
  vm.runInNewContext(compiled, {
    exports,
    require: id => id === 'next/navigation'
      ? { useRouter: () => router, useSearchParams: () => new URLSearchParams(query) }
      : id.startsWith('@/') ? loadModule(id.slice(2) + '.ts') : require(id),
    URLSearchParams,
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id },
    clearTimeout: id => timers.delete(id),
  })

  function element(total = 12) {
    const params = new URLSearchParams(query)
    return React.createElement(exports.JobFilters, {
      search: params.get('search')?.trim() || '',
      status: params.get('status') || 'all',
      priority: params.get('priority') || 'all',
      total,
    }, React.createElement('p', null, 'Current results'))
  }
  let renderer
  act(() => { renderer = create(element(), { createNodeMock: () => ({ focus: () => focuses++ }) }) })
  t.after(() => act(() => renderer.unmount()))
  const input = () => renderer.root.findByProps({ id: 'jobs-search' })
  return {
    navigations,
    renderer,
    input,
    focuses: () => focuses,
    type(value) { act(() => input().props.onChange({ target: { value } })) },
    select(field, value) { act(() => renderer.root.findByProps({ id: `jobs-${field}` }).props.onChange({ target: { value } })) },
    clear() { act(() => renderer.root.findByType('button').props.onClick()) },
    commit(nextQuery, total) { query = nextQuery.replace(/^\/jobs\??/, ''); act(() => renderer.update(element(total))) },
    advance(ms) {
      now += ms
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now && timers.has(id)) { timers.delete(id); act(timer.callback) }
      }
    },
    latest() { return new URL(navigations.at(-1).href, 'http://localhost').searchParams },
  }
}

test('debounces search and keeps view/sort parameters while resetting pagination', t => {
  const h = setup(t, 'mine=1&sort=dateRequired&dir=asc&page=4')
  h.type('bra')
  h.advance(200)
  h.type('bracket')
  h.advance(299)
  assert.equal(h.navigations.length, 0)
  assert.equal(h.renderer.root.findByProps({ 'aria-label': 'Job results' }).props['aria-busy'], true)
  assert.equal(h.renderer.root.findByType('p').children[0], 'Current results')
  h.advance(1)
  assert.equal(h.navigations.length, 1)
  assert.equal(h.latest().get('search'), 'bracket')
  assert.equal(h.latest().get('mine'), '1')
  assert.equal(h.latest().get('sort'), 'dateRequired')
  assert.equal(h.latest().get('dir'), 'asc')
  assert.equal(h.latest().has('page'), false)
  assert.equal(h.navigations[0].options.scroll, false)
})

test('select changes apply immediately and include unsubmitted search and other selections', t => {
  const h = setup(t, 'assigned=1&page=3')
  h.type('sensor')
  h.advance(100)
  h.select('status', 'completed')
  h.select('priority', 'urgent')
  assert.equal(h.navigations.length, 2)
  assert.equal(h.latest().get('search'), 'sensor')
  assert.equal(h.latest().get('status'), 'completed')
  assert.equal(h.latest().get('priority'), 'urgent')
  assert.equal(h.latest().get('assigned'), '1')
  h.advance(1000)
  assert.equal(h.navigations.length, 2)
})

test('Clear cancels pending typing and retains personal view and sort', t => {
  const h = setup(t, 'assigned=1&search=old&status=pending&priority=urgent&page=2&sort=id&dir=desc')
  h.type('new')
  h.clear()
  assert.equal(h.input().props.value, '')
  assert.equal(h.latest().get('assigned'), '1')
  assert.equal(h.latest().get('sort'), 'id')
  for (const key of ['search', 'status', 'priority', 'page']) assert.equal(h.latest().has(key), false)
  assert.equal(h.focuses(), 1)
  h.advance(1000)
  assert.equal(h.navigations.length, 1)
})

test('an earlier response does not overwrite newer typing or cancel its debounce', t => {
  const h = setup(t)
  h.type('pump')
  h.advance(300)
  const earlier = h.navigations[0].href
  h.type('pump mount')
  h.advance(100)
  h.commit(earlier, 4)
  assert.equal(h.input().props.value, 'pump mount')
  assert.equal(h.renderer.root.findByProps({ 'aria-label': 'Job results' }).props['aria-busy'], true)
  h.advance(200)
  assert.equal(h.navigations.length, 2)
  assert.equal(h.latest().get('search'), 'pump mount')
  h.commit(h.navigations[1].href, 1)
  assert.equal(h.input().props.value, 'pump mount')
  assert.equal(h.renderer.root.findByProps({ role: 'status' }).children.at(-1), '1 job')
})

test('external navigation resynchronizes controls and cancels pending search', t => {
  const h = setup(t, 'mine=1&search=bracket')
  h.type('stale search')
  h.commit('/jobs?assigned=1&search=valve&status=inprogress')
  assert.equal(h.input().props.value, 'valve')
  assert.equal(h.renderer.root.findByProps({ id: 'jobs-status' }).props.value, 'inprogress')
  h.advance(1000)
  assert.equal(h.navigations.length, 0)
})

test('unmount cancels a pending debounce', t => {
  const h = setup(t)
  h.type('discarded')
  act(() => h.renderer.unmount())
  h.advance(1000)
  assert.equal(h.navigations.length, 0)
})

test('input composition waits until composition ends before searching', t => {
  const h = setup(t)
  act(() => h.input().props.onCompositionStart())
  h.type('部')
  h.advance(1000)
  assert.equal(h.navigations.length, 0)
  act(() => h.input().props.onCompositionEnd({ currentTarget: { value: '部品' } }))
  h.advance(300)
  assert.equal(h.latest().get('search'), '部品')
})

test('Enter applies search immediately without a second debounced navigation', t => {
  const h = setup(t)
  let prevented = false
  h.type('#278')
  act(() => h.renderer.root.findByType('form').props.onSubmit({ preventDefault: () => { prevented = true } }))
  assert.equal(prevented, true)
  assert.equal(h.latest().get('search'), '#278')
  h.advance(1000)
  assert.equal(h.navigations.length, 1)
  assert.equal(h.renderer.root.findAllByProps({ type: 'submit' }).length, 0)
})

test('clearing the search field applies immediately and preserves dropdown filters', t => {
  const h = setup(t, 'search=valve&status=pending&priority=normal')
  h.type('')
  assert.equal(h.navigations.length, 1)
  assert.equal(h.latest().has('search'), false)
  assert.equal(h.latest().get('status'), 'pending')
  assert.equal(h.latest().get('priority'), 'normal')
})

test('unchanged normalized search avoids a redundant navigation', t => {
  const h = setup(t, 'search=valve')
  h.type(' valve ')
  h.advance(300)
  assert.equal(h.navigations.length, 0)
  assert.equal(h.input().props.value, ' valve ')
})
