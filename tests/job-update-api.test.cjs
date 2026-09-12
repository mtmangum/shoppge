const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./helpers/load-ts.cjs')

function setup({ role = 'machinist', exists = true } = {}) {
  const calls = { reads: 0, updates: [], deletes: 0 }
  const db = {
    select() {
      calls.reads++
      const query = {
        from: () => query, where: () => query, limit: () => query,
        then: (yes, no) => Promise.resolve(exists ? [{ id: 42 }] : []).then(yes, no),
      }
      return query
    },
    update: () => ({ set: data => ({ where: async () => { calls.updates.push(data) } }) }),
    delete: () => ({ where: async () => { calls.deletes++ } }),
  }
  const route = loadTs('app/api/jobs/[id]/route.ts', {
    '@/lib/db': { db },
    '@/lib/auth': {
      requireMachinist: async () => { if (!['machinist', 'admin'].includes(role)) throw new Error('Forbidden') },
      requireAdmin: async () => { if (role !== 'admin') throw new Error('Forbidden') },
    },
    '@/lib/s3': { deleteAttachment: async () => {} },
  })
  return {
    calls,
    update: body => route.PATCH({ json: async () => body }, { params: { id: '42' } }),
    remove: () => route.DELETE({}, { params: { id: '42' } }),
  }
}

test('job PATCH accepts assignment, unassignment, materials, notes, and priority changes', async () => {
  for (const data of [{ machinistId: 7 }, { machinistId: null }, { materialsRequired: true },
    { materialsOrdered: true }, { machinistNotes: 'Fixture notes' }, { priority: 'urgent' }]) {
    const h = setup()
    assert.equal((await h.update(data)).status, 200)
    const actual = { ...h.calls.updates[0] }
    assert.ok(actual.updatedAt)
    delete actual.updatedAt
    assert.deepEqual(actual, data)
  }
})

test('invalid job field values are rejected before a database query', async () => {
  for (const body of [{ machinistId: '7' }, { materialsRequired: 'yes' }, { priority: 'invalid' }]) {
    const h = setup()
    assert.equal((await h.update(body)).status, 400)
    assert.equal(h.calls.reads, 0)
    assert.equal(h.calls.updates.length, 0)
  }
})

test('job PATCH does not allow status changes to bypass status history', async () => {
  const h = setup()
  assert.equal((await h.update({ machinistNotes: 'Notes', status: 'completed' })).status, 200)
  assert.equal(Object.hasOwn(h.calls.updates[0], 'status'), false)
})

test('requestors cannot update machinist fields or delete jobs', async () => {
  const h = setup({ role: 'requestor' })
  assert.ok((await h.update({ machinistNotes: 'Notes' })).status >= 400)
  assert.ok((await h.remove()).status >= 400)
  assert.equal(h.calls.reads, 0)
  assert.equal(h.calls.deletes, 0)
})

test('machinists cannot call the admin-only job deletion endpoint', async () => {
  const h = setup()
  assert.ok((await h.remove()).status >= 400)
  assert.equal(h.calls.reads, 0)
  assert.equal(h.calls.deletes, 0)
})

test('updates to missing jobs return 404 and do not write', async () => {
  const h = setup({ exists: false })
  assert.equal((await h.update({ materialsRequired: true })).status, 404)
  assert.equal(h.calls.updates.length, 0)
})
