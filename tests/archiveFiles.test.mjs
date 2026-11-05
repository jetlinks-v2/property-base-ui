import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const calls = []
globalThis.__fileRequest = Object.fromEntries(
  ['get', 'post', 'put', 'remove'].map((method) => [
    method,
    async (...args) => {
      calls.push({ method, args })
      if (args[0].includes('_import')) return { success: true, result: { count: 1 } }
      return new Blob(['xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    }
  ])
)
const result = await build({
  entryPoints: [fileURLToPath(new URL('../api/archive.ts', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  plugins: [
    {
      name: 'request',
      setup(builder) {
        builder.onResolve({ filter: /^@jetlinks-web\/core$/ }, (args) => ({ path: args.path, namespace: 'request' }))
        builder.onLoad({ filter: /.*/, namespace: 'request' }, () => ({
          contents: 'export const request = globalThis.__fileRequest'
        }))
      }
    }
  ]
})
const module = { exports: {} }
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports)
const api = module.exports

test('导入通过宿主认证请求上传multipart原文件，仅携带外层项目', async () => {
  const file = new File(['xlsx'], '客户.xlsx')
  assert.deepEqual(await api.importCustomers({ projectId: 'project', spaceId: 'subtree' }, file, 'person'), {
    count: 1
  })
  const { method, args } = calls.at(-1)
  assert.equal(method, 'post')
  assert.equal(args[0], '/property/customer/_import?projectId=project&customerType=person')
  assert.ok(args[1] instanceof FormData)
  assert.equal(args[1].get('file'), file)
  assert.deepEqual(args[2], { hiddenError: true })
})

test('企业客户模板和上传显式携带企业类型，不会使用混合客户模板', async () => {
  await api.getArchiveTemplate({ projectId: 'project' }, 'customer', 'company')
  assert.equal(calls.at(-1).args[0], '/property/customer/template.xlsx?projectId=project&customerType=company')
  await api.importCustomers({ projectId: 'project' }, new File(['x'], '企业.xlsx'), 'company')
  assert.equal(calls.at(-1).args[0], '/property/customer/_import?projectId=project&customerType=company')
})

test('模板由后端GET提供blob，导出保留子树筛选及历史字段映射', async () => {
  const scope = { projectId: 'project', spaceId: 'subtree' }
  assert.ok((await api.getArchiveTemplate(scope, 'house')) instanceof Blob)
  assert.deepEqual(calls.at(-1), {
    method: 'get',
    args: ['/property/house/template.xlsx?projectId=project', {}, { responseType: 'blob', hiddenError: true }]
  })
  const query = { terms: [{ column: 'name', termType: 'like', value: '张' }] }
  assert.ok((await api.exportCustomers(scope, query, true)) instanceof Blob)
  const call = calls.at(-1)
  assert.equal(call.args[0], '/property/customer/_export?projectId=project&spaceId=subtree&history=true')
  assert.equal(call.args[1].terms[0].column, 'customer.name')
  assert.deepEqual(call.args[2], { responseType: 'blob', hiddenError: true })
  assert.equal(query.terms[0].column, 'name')
})
