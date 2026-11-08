import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { effectScope, nextTick, ref } from 'vue'

const require = createRequire(import.meta.url)
const result = await build({
  entryPoints: [fileURLToPath(new URL('../hooks/useProjectSeal.ts', import.meta.url))],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  external: ['vue'],
  plugins: [
    {
      name: 'seal-dependencies',
      setup(builder) {
        builder.onResolve({ filter: /api\/organization|@jetlinks-web|vue-i18n/ }, (args) => ({
          path: args.path,
          namespace: 'mock'
        }))
        builder.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({
          contents: args.path.includes('api/organization')
            ? 'export const uploadProjectSeal = (...args) => globalThis.__seal.upload(...args); export const removeProjectSeal = (...args) => globalThis.__seal.remove(...args)'
            : args.path === 'vue-i18n'
              ? 'export const useI18n = () => ({t: key => key})'
              : args.path.includes('hooks')
                ? 'export const usePermission = () => ({hasPerm: globalThis.__seal.allowed})'
                : args.path.includes('api/comm')
                  ? 'export const getFileUrlById = id => `/file/${id}`'
                  : 'export const onlyMessage = (...args) => globalThis.__seal.messages.push(args)'
        }))
      }
    }
  ]
})
const module = { exports: {} }
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports)
const { useProjectSeal } = module.exports
const success = (result) => ({ success: true, result })
const project = (id = 'park') => ({
  id,
  name: id,
  version: 4,
  organizationType: { value: 'project' },
  projectSealFileId: 'old'
})
const file = (type = 'image/png', size = 30) => ({ type, size })
const deferred = () => {
  let resolve
  const promise = new Promise((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}
function mount(overrides = {}) {
  const calls = [],
    saved = [],
    stale = [],
    messages = []
  const organization = ref(project())
  globalThis.__seal = {
    allowed: ref(true),
    messages,
    upload: async (id, version, image) => {
      calls.push(['upload', id, version, image])
      return success({ ...organization.value, projectSealFileId: 'new', version: version + 1 })
    },
    remove: async (id, version) => {
      calls.push(['remove', id, version])
      return success({ ...organization.value, projectSealFileId: null, version: version + 1 })
    },
    ...overrides
  }
  const scope = effectScope()
  const state = scope.run(() =>
    useProjectSeal(
      organization,
      (value) => {
        saved.push(value)
        organization.value = value
      },
      () => stale.push(true)
    )
  )
  return { state, organization, calls, saved, stale, messages, stop: () => scope.stop() }
}

test('项目章在组织接口一次上传并保存，替换和移除使用最新版本', async () => {
  const m = mount()
  try {
    assert.equal(m.state.imageUrl.value, '/file/old')
    const image = file()
    await m.state.persist(image)
    assert.deepEqual(m.calls, [['upload', 'park', 4, image]])
    assert.equal(m.organization.value.version, 5)
    assert.equal(m.state.imageUrl.value, '/file/new')
    await m.state.persist(image)
    assert.deepEqual(m.calls[1], ['upload', 'park', 5, image])
    await m.state.persist(null)
    assert.deepEqual(m.calls[2], ['remove', 'park', 6])
    assert.equal(m.state.imageUrl.value, '')
    assert.equal(m.saved.length, 3)
    assert.equal(m.state.busy.value, false)
  } finally {
    m.stop()
  }
})

test('无权限、非项目、文件类型或大小不符时不上传不保存', async () => {
  const m = mount()
  try {
    for (const image of [file('image/svg+xml'), file('image/png', 0), file('image/jpeg', 2 * 1024 * 1024 + 1)]) {
      await m.state.persist(image)
    }
    assert.equal(m.messages.length, 3)
    globalThis.__seal.allowed.value = false
    await m.state.persist(file())
    await m.state.persist(null)
    globalThis.__seal.allowed.value = true
    m.organization.value.organizationType = { value: 'external' }
    await m.state.persist(file())
    assert.equal(m.state.isProject.value, false)
    assert.deepEqual(m.calls, [])
  } finally {
    m.stop()
  }
})

test('上传保存或移除失败保留原章，并刷新不确定结果，不自动重试', async () => {
  let attempts = 0
  const m = mount({
    upload: async () => {
      attempts++
      throw new Error('upload failed')
    }
  })
  try {
    await m.state.persist(file())
    assert.equal(m.organization.value.projectSealFileId, 'old')
    assert.equal(m.stale.length, 1)
    globalThis.__seal.remove = async () => {
      attempts++
      throw { response: { data: { message: '版本冲突' } } }
    }
    await m.state.persist(null)
    assert.equal(m.organization.value.projectSealFileId, 'old')
    assert.equal(m.stale.length, 2)
    assert.equal(attempts, 2)
    assert.equal(m.saved.length, 0)
    assert.equal(m.messages.length, 2)
    assert.equal(m.state.busy.value, false)
  } finally {
    m.stop()
  }
})

test('重复点击只提交一次；上传期间切换组织不会把文件存入另一组织', async () => {
  const pending = deferred()
  const calls = []
  const m = mount({ upload: (...args) => { calls.push(args); return pending.promise } })
  try {
    const image = file()
    const first = m.state.persist(image)
    await m.state.persist(file())
    assert.deepEqual(calls, [['park', 4, image]])
    assert.equal(m.state.busy.value, true)
    m.organization.value = project('other')
    await nextTick()
    pending.resolve(success({ ...project(), projectSealFileId: 'new', version: 5 }))
    await first
    assert.equal(m.saved.length, 0)
    assert.equal(m.messages.length, 0)
    assert.equal(m.organization.value.id, 'other')
    assert.equal(m.state.busy.value, false)
  } finally {
    m.stop()
  }
})

test('保存期间切换组织或卸载，迟到响应不更新当前详情', async () => {
  for (const unload of [false, true]) {
    const pending = deferred()
    const m = mount({ remove: () => pending.promise })
    const task = m.state.persist(null)
    if (unload) m.stop()
    else {
      m.organization.value = project('other')
      await nextTick()
    }
    pending.resolve(success({ ...project(), projectSealFileId: null, version: 5 }))
    await task
    assert.equal(m.saved.length, 0)
    assert.equal(m.messages.length, 0)
    m.stop()
  }
})

test('项目章仅调用组织受控multipart和移除接口，不调用平台上传或提交任意文件ID', async () => {
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL('../api/organization.ts', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    plugins: [
      {
        name: 'request',
        setup(builder) {
          builder.onResolve({ filter: /@jetlinks-web\/core/ }, (args) => ({ path: args.path, namespace: 'mock' }))
          builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
            contents: 'export const request = globalThis.__sealRequest'
          }))
        }
      }
    ]
  })
  const calls = []
  globalThis.__sealRequest = {
    put: (...args) => calls.push(['put', ...args]),
    remove: (...args) => calls.push(['delete', ...args])
  }
  const apiModule = { exports: {} }
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(require, apiModule, apiModule.exports)
  apiModule.exports.uploadProjectSeal('park/id', 4, new Blob(['image'], { type: 'image/png' }))
  apiModule.exports.removeProjectSeal('park/id', 5)
  assert.equal(calls[0][0], 'put')
  assert.equal(calls[0][1], '/property/organization/park%2Fid/project-seal?version=4')
  assert.ok(calls[0][2] instanceof FormData)
  assert.deepEqual([...calls[0][2].keys()], ['file'])
  assert.equal(calls[0][2].get('file').size, 5)
  assert.deepEqual(calls[0][3], { hiddenError: true })
  assert.deepEqual(calls[1], [
    'delete',
    '/property/organization/park%2Fid/project-seal?version=5',
    {},
    { hiddenError: true }
  ])
})

test('2MB边界图片允许提交；失败响应不能冒充已保存的组织', async () => {
  const m = mount({ upload: async () => ({ success: false, message: '图片校验失败' }) })
  try {
    await m.state.persist(file('image/jpeg', 2 * 1024 * 1024))
    assert.equal(m.saved.length, 0)
    assert.equal(m.messages.length, 1)
    assert.equal(m.stale.length, 1)
    assert.equal(m.organization.value.projectSealFileId, 'old')
  } finally { m.stop() }
})
