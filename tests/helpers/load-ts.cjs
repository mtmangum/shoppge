const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')

// Run the real TypeScript module while replacing external side effects.
// Fail closed if a test accidentally imports a live service module.
module.exports = function loadTs(file, mocks = {}, globals = {}) {
  const cache = new Map()
  function load(filename) {
    const resolved = path.resolve(root, filename)
    if (cache.has(resolved)) return cache.get(resolved)
    const exports = {}
    cache.set(resolved, exports)
    const compiled = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
    }).outputText
    vm.runInNewContext(compiled, {
      exports, URL, Request, Response, FormData, File, Buffer, console,
      require: id => {
        if (Object.hasOwn(mocks, id)) return mocks[id]
        if (/^@\/lib\/(db|auth|s3|mail)$/.test(id)) throw new Error(`Unmocked service: ${id}`)
        if (id.startsWith('@/')) return load(id.slice(2) + '.ts')
        return require(id)
      },
      ...globals,
    }, { filename: resolved })
    return exports
  }
  return load(file)
}
