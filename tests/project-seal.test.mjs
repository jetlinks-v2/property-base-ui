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
            ? 'export const uploadProjectSeal = (...args) => globalThis.__seal.upload(...args); export const setProjectSeal = (...args) => globalThis.__seal.save(...args)'
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
    upload: async (image) => {
      calls.push(['upload', image])
      return success({ id: 'new' })
    },
    save: async (id, fileId, version) => {
      calls.push(['save', id, fileId, version])
      return success({ ...organization.value, projectSealFileId: fileId, version: version + 1 })
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

test('项目章上传后用平台文件ID和最新版本保存；替换和删除不删除文件', async () => {
  const m = mount()
  try {
    assert.equal(m.state.imageUrl.value, '/file/old')
    await m.state.persist(file())
    assert.deepEqual(m.calls[1], ['save', 'park', 'new', 4])
    assert.equal(m.organization.value.version, 5)
    assert.equal(m.state.imageUrl.value, '/file/new')
    await m.state.persist(null)
    assert.deepEqual(m.calls[2], ['save', 'park', null, 5])
    assert.equal(m.state.imageUrl.value, '')
    assert.equal(m.saved.length, 2)
    assert.equal(m.state.busy.value, false)
  } finally {
    m.stop()
  }
})

test('无权限、非项目、文件类型或大小不符时不上传不保存', async () => {
  const m = mount()
  try {
    for (const image of [file('image/svg+xml'), file('image/png', 0), file('image/jpeg', 5 * 1024 * 1024 + 1)]) {
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

test('上传失败保留原章；保存失败提示并请求刷新，不自动重试', async () => {
  const m = mount({
    upload: async () => {
      throw new Error('upload failed')
    }
  })
  try {
    await m.state.persist(file())
    assert.equal(m.organization.value.projectSealFileId, 'old')
    assert.equal(m.stale.length, 0)
    globalThis.__seal.upload = async () => success({ id: 'new' })
    globalThis.__seal.save = async () => {
      throw { response: { data: { message: '版本冲突' } } }
    }
    await m.state.persist(file())
    assert.equal(m.organization.value.projectSealFileId, 'old')
    assert.equal(m.stale.length, 1)
    assert.equal(m.saved.length, 0)
    assert.equal(m.messages.length, 2)
    assert.equal(m.state.busy.value, false)
  } finally {
    m.stop()
  }
})

test('重复点击只提交一次；上传期间切换组织不会把文件存入另一组织', async () => {
  const pending = deferred()
  const m = mount({ upload: () => pending.promise })
  try {
    const first = m.state.persist(file())
    await m.state.persist(file())
    assert.equal(m.state.busy.value, true)
    m.organization.value = project('other')
    await nextTick()
    pending.resolve(success({ id: 'new' }))
    await first
    assert.deepEqual(m.calls, [])
    assert.equal(m.saved.length, 0)
    assert.equal(m.state.busy.value, false)
  } finally {
    m.stop()
  }
})

test('保存期间切换组织或卸载，迟到响应不更新当前详情', async () => {
  for (const unload of [false, true]) {
    const pending = deferred()
    const m = mount({ save: () => pending.promise })
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

test('项目章请求复用宿主上传接口，清除显式发送null，错误由局部提示处理', async () => {
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
  globalThis.__sealRequest = { post: (...args) => calls.push(args), put: (...args) => calls.push(args) }
  const apiModule = { exports: {} }
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(require, apiModule, apiModule.exports)
  apiModule.exports.uploadProjectSeal(new Blob(['image'], { type: 'image/png' }))
  apiModule.exports.setProjectSeal('park/id', null, 4)
  assert.equal(calls[0][0], '/file/upload')
  assert.ok(calls[0][1] instanceof FormData)
  assert.equal(calls[0][1].get('file').size, 5)
  assert.deepEqual(calls[0][2], { hiddenError: true })
  assert.deepEqual(calls[1], [
    '/property/organization/park%2Fid/seal',
    { fileId: null, version: 4 },
    { hiddenError: true }
  ])
})
