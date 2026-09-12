const { test } = require('node:test')
const assert = require('node:assert/strict')
const loadTs = require('./helpers/load-ts.cjs')

function setup({ role = 'machinist', exists = true, storageFails = false, userId = '7', requestorId = 7 } = {}) {
  const calls = { uploads: [], deletes: [], inserts: [], dbDeletes: 0, reads: 0 }
  const db = {
    select() {
      calls.reads++
      const query = {
        from: () => query, where: () => query, limit: () => query,
        then: (yes, no) => Promise.resolve(exists ? [{ id: 5, jobId: 42, storageKey: 'fixture/part.pdf', originalName: 'part.pdf', requestorId }] : []).then(yes, no),
      }
      return query
    },
    insert: () => ({ values: entry => {
      calls.inserts.push(entry)
      return { returning: async () => [{ id: 5, ...entry }] }
    } }),
    delete: () => ({ where: async () => { calls.dbDeletes++ } }),
  }
  async function requireAuth() {
    if (!role) throw new Error('Unauthorized')
    return { id: userId, role }
  }
  const mocks = {
    '@/lib/db': { db },
    '@/lib/auth': {
      requireAuth,
      requireMachinist: async () => {
        const user = await requireAuth()
        if (!['machinist', 'admin'].includes(user.role)) throw new Error('Forbidden: machinist role required')
        return user
      },
      isJobOwnerOrElevated: (user, job) => user.role !== 'requestor' || job.requestorId === parseInt(user.id, 10),
    },
    '@/lib/s3': {
      uploadAttachment: async (...args) => { calls.uploads.push(args); if (storageFails) throw new Error('Storage unavailable') },
      deleteAttachment: async key => { calls.deletes.push(key); if (storageFails) throw new Error('Storage unavailable') },
      getAttachmentDownloadUrl: async () => 'https://storage.example.test/signed-fixture',
    },
  }
  const upload = loadTs('app/api/jobs/[id]/attachments/route.ts', mocks)
  const attachment = loadTs('app/api/jobs/[id]/attachments/[attachmentId]/route.ts', mocks)
  return {
    calls,
    async upload(file) {
      const form = new FormData()
      if (file) form.set('file', file)
      return upload.POST({ formData: async () => form }, { params: { id: '42' } })
    },
    remove: () => attachment.DELETE({}, { params: { id: '42', attachmentId: '5' } }),
    download: () => attachment.GET({}, { params: { id: '42', attachmentId: '5' } }),
  }
}

test('supported attachments save bytes and metadata for the authenticated uploader', async () => {
  const h = setup({ role: 'requestor' })
  // Content must start with the real PDF magic bytes: file type is now
  // verified server-side against actual content, not the claimed MIME type.
  const response = await h.upload(new File(['%PDF-drawing'], 'part.pdf', { type: 'application/pdf' }))
  assert.equal(response.status, 201)
  assert.equal(h.calls.uploads[0][1].toString(), '%PDF-drawing')
  assert.equal(h.calls.uploads[0][2], 'application/pdf')
  assert.equal(h.calls.inserts[0].jobId, 42)
  assert.equal(h.calls.inserts[0].uploadedById, 7)
  assert.equal(h.calls.inserts[0].originalName, 'part.pdf')
})

test('a requestor cannot upload to or download another requestor\'s job', async () => {
  const h = setup({ role: 'requestor', userId: '99', requestorId: 7 })
  const uploadResponse = await h.upload(new File(['%PDF-drawing'], 'part.pdf', { type: 'application/pdf' }))
  assert.equal(uploadResponse.status, 403)
  assert.equal(h.calls.uploads.length, 0)
  assert.equal(h.calls.inserts.length, 0)

  const downloadResponse = await h.download()
  assert.equal(downloadResponse.status, 403)
})

test('missing, unsupported, and oversized attachments never reach storage', async () => {
  const files = [undefined, new File(['code'], 'part.exe', { type: 'application/octet-stream' }),
    new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' })]
  for (const file of files) {
    const h = setup()
    const response = await h.upload(file)
    assert.equal(response.status, 400)
    assert.equal(h.calls.uploads.length, 0)
    assert.equal(h.calls.inserts.length, 0)
  }
})

test('failed storage uploads never insert attachment metadata', async () => {
  const h = setup({ storageFails: true })
  const response = await h.upload(new File(['drawing'], 'part.pdf', { type: 'application/pdf' }))
  assert.equal(response.status, 400)
  assert.equal(h.calls.inserts.length, 0)
})

test('requestors cannot delete attachments through the API', async () => {
  const h = setup({ role: 'requestor' })
  const response = await h.remove()
  assert.equal(response.status, 403)
  assert.equal(h.calls.reads, 0)
  assert.equal(h.calls.deletes.length, 0)
  assert.equal(h.calls.dbDeletes, 0)
})

test('machinists and admins can delete attachments', async () => {
  for (const role of ['machinist', 'admin']) {
    const h = setup({ role })
    const response = await h.remove()
    assert.equal(response.status, 200)
    assert.deepEqual(h.calls.deletes, ['fixture/part.pdf'])
    assert.equal(h.calls.dbDeletes, 1)
  }
})

test('failed storage deletion keeps the attachment record', async () => {
  const h = setup({ storageFails: true })
  const response = await h.remove()
  assert.equal(response.status, 400)
  assert.equal(h.calls.dbDeletes, 0)
})

test('downloads require authentication and redirect to a signed storage URL', async () => {
  const denied = setup({ role: null })
  assert.equal((await denied.download()).status, 401)
  assert.equal(denied.calls.reads, 0)
  const response = await setup().download()
  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), 'https://storage.example.test/signed-fixture')
})

test('missing attachment downloads/deletes return 404 without storage deletion', async () => {
  const h = setup({ exists: false })
  assert.equal((await h.download()).status, 404)
  assert.equal((await h.remove()).status, 404)
  assert.equal(h.calls.deletes.length, 0)
})
