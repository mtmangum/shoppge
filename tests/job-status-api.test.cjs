const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./helpers/load-ts.cjs')

function setup({ status = 'pending', exists = true, failHistory = false, denied = false } = {}) {
  let job = { status, dateCompleted: status === 'completed' ? '2026-01-15' : null, completedById: status === 'completed' ? 3 : null }
  let history = []
  let queries = 0
  let transactions = 0
  const db = {
    select() {
      queries++
      const query = {
        from: () => query, where: () => query, limit: () => query, for: () => query,
        then: (yes, no) => Promise.resolve(exists ? [{ ...job }] : []).then(yes, no),
      }
      return query
    },
    update: () => ({ set: updates => ({ where: async () => { job = { ...job, ...updates } } }) }),
    insert: () => ({ values: async entry => {
      if (failHistory) throw new Error('History write failed')
      history.push(JSON.parse(JSON.stringify(entry)))
    } }),
    async transaction(callback) {
      transactions++
      const before = { ...job }
      const beforeHistory = [...history]
      try { return await callback(db) }
      catch (error) { job = before; history = beforeHistory; throw error }
    },
  }
  const { PATCH } = loadTs('app/api/jobs/[id]/status/route.ts', {
    '@/lib/db': { db },
    '@/lib/auth': { requireMachinist: async () => {
      if (denied) throw new Error('Forbidden: machinist role required')
      return { id: '7', role: 'machinist' }
    } },
  })
  return {
    job: () => job, history: () => history, queries: () => queries, transactions: () => transactions,
    save: body => PATCH(new Request('http://unit.test/api/jobs/42/status', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }), { params: { id: '42' } }),
  }
}

test('status API updates the job and records actor, old/new status, and note', async () => {
  const h = setup()
  const response = await h.save({ status: 'inprogress', note: 'Started work' })
  assert.equal(response.status, 200)
  assert.equal(h.job().status, 'inprogress')
  assert.deepEqual(h.history()[0], { jobId: 42, fromStatus: 'pending', toStatus: 'inprogress', changedById: 7, note: 'Started work' })
})

test('completing a job records the completion date and machinist', async () => {
  const h = setup()
  const response = await h.save({ status: 'completed' })
  assert.equal(response.status, 200)
  assert.match(h.job().dateCompleted, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(h.job().completedById, 7)
})

test('reopening a completed job clears stale completion metadata', async () => {
  const h = setup({ status: 'completed' })
  await h.save({ status: 'inprogress' })
  assert.equal(h.job().dateCompleted, null)
  assert.equal(h.job().completedById, null)
})

test('a note on an already completed job preserves the original completion attribution', async () => {
  const h = setup({ status: 'completed' })
  await h.save({ status: 'completed', note: 'Collected by requestor' })
  assert.equal(h.job().dateCompleted, '2026-01-15')
  assert.equal(h.job().completedById, 3)
  assert.equal(h.history().length, 1)
})

test('a history failure cannot leave a status change committed without its audit entry', async () => {
  const h = setup({ failHistory: true })
  const response = await h.save({ status: 'completed' })
  assert.notEqual(response.status, 200)
  assert.equal(h.job().status, 'pending')
  assert.equal(h.job().dateCompleted, null)
  assert.equal(h.history().length, 0)
  assert.equal(h.transactions(), 1)
})

test('an unchanged status without a note does not create duplicate history', async () => {
  const h = setup()
  const response = await h.save({ status: 'pending' })
  assert.equal(response.status, 200)
  assert.equal(h.history().length, 0)
})

test('invalid statuses and denied users cannot query or change jobs', async () => {
  for (const denied of [false, true]) {
    const h = setup({ denied })
    const response = await h.save({ status: denied ? 'completed' : 'unknown' })
    assert.ok(response.status >= 400)
    assert.equal(h.queries(), 0)
    assert.equal(h.history().length, 0)
  }
})

test('missing jobs return 404 without a history entry', async () => {
  const h = setup({ exists: false })
  const response = await h.save({ status: 'completed' })
  assert.equal(response.status, 404)
  assert.equal(h.history().length, 0)
})
