import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createRenderer, defineComponent, h, nextTick, ref } from 'vue'

const require = createRequire(import.meta.url)
const load = async (entry, mockApi = false) => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(entry, import.meta.url))],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['vue'],
    plugins: mockApi
      ? [
          {
            name: 'organization-dependencies',
            setup(builder) {
              builder.onResolve({ filter: /api\/organization|@jetlinks-web|vue-i18n/ }, (args) => ({
                path: args.path,
                namespace: 'mock'
              }))
              builder.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({
                contents: args.path.includes('api/organization')
                  ? [
                      'getOrganization',
                      'getOrganizationTree',
                      'getOrganizationTypes',
                      'getOrganizationSyncStatus',
                      'setOrganizationType',
                      'synchronizeOrganizations'
                    ]
                      .map(
                        (name) =>
                          `export const ${name} = (...args) => globalThis.__organizationTestApi.${name}(...args)`
                      )
                      .join('\n')
                  : args.path === 'vue-i18n'
                    ? 'export const useI18n = () => ({t: (key) => key})'
                    : args.path.includes('hooks')
                      ? "import {ref} from 'vue'; export const usePermission = () => ({hasPerm: ref(true)})"
                      : 'export const onlyMessage = () => {}'
              }))
            }
          }
        ]
      : []
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports)
  return module.exports
}
const treeUtils = await load('../utils/organizationTree.ts')
const { useOrganizationType } = await load('../hooks/useOrganizationType.ts', true)
const node = (id, type = null, children = []) => ({ id, name: id, version: 0, organizationType: type, children })
const tree = [node('company', { value: 'external', text: '外协单位' }, [node('park')])]
const success = (result) => ({ success: true, result })
const settle = async () => {
  await new Promise((resolve) => setImmediate(resolve))
  await nextTick()
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function mount(api = {}) {
  globalThis.__organizationTestApi = {
    getOrganizationTree: async () => success(structuredClone(tree)),
    getOrganizationTypes: async () =>
      success([
        { value: 'project', text: '项目' },
        { value: 'external', text: '外协单位' }
      ]),
    getOrganizationSyncStatus: async () => success({ running: false }),
    getOrganization: async (id) => success(node(id)),
    ...api
  }
  const renderer = createRenderer({
    createElement: () => ({}),
    createText: () => ({}),
    createComment: () => ({}),
    insert() {},
    remove() {},
    setText() {},
    setElementText() {},
    patchProp() {},
    parentNode: () => null,
    nextSibling: () => null
  })
  let state
  const app = renderer.createApp(
    defineComponent({
      setup() {
        state = useOrganizationType()
        return () => h('div')
      }
    })
  )
  app.mount({})
  return { state, unmount: () => app.unmount() }
}

test('搜索与未标注筛选保留祖先，但祖先不计为命中', () => {
  const result = treeUtils.filterOrganizationTree(tree, 'PARK', true)
  assert.equal(result[0].contextOnly, true)
  assert.equal(result[0].children[0].id, 'park')
  assert.equal(result[0].children[0].contextOnly, false)
  assert.deepEqual(treeUtils.filterOrganizationTree(tree, 'missing', false), [])
})
test('更新单个组织保留子树及其他组织的标注', () => {
  const result = treeUtils.replaceOrganization(tree, { ...node('company'), version: 1 })
  assert.equal(result[0].children[0].id, 'park')
  assert.equal(tree[0].organizationType.value, 'external')
})

test('项目章保存后更新当前详情和树版本，其他组织迟到结果不覆盖当前选择', async () => {
  const { state, unmount } = mount()
  await settle()
  await state.select('park')
  state.acceptDetail({ ...node('park'), projectSealFileId: 'seal', version: 2 })
  assert.equal(state.detail.value.projectSealFileId, 'seal')
  assert.equal(state.tree.value[0].children[0].version, 2)
  state.acceptDetail({ ...node('company'), projectSealFileId: 'other', version: 3 })
  assert.equal(state.detail.value.id, 'park')
  assert.equal(state.detail.value.version, 2)
  unmount()
})
test('切换组织时旧详情响应不能覆盖新选择', async () => {
  const old = deferred()
  const { state, unmount } = mount({
    getOrganization: (id) => (id === 'old' ? old.promise : Promise.resolve(success(node(id))))
  })
  await settle()
  const first = state.select('old')
  await state.select('park')
  old.resolve(success(node('old')))
  await first
  assert.equal(state.detail.value.id, 'park')
  unmount()
})
test('保存失败保留已保存标签，刷新版本后由用户重新选择', async () => {
  const { state, unmount } = mount({
    setOrganizationType: async () => {
      throw new Error('409 conflict')
    }
  })
  await settle()
  await state.select('park')
  await state.save('project')
  assert.equal(state.detail.value.organizationType, null)
  assert.equal(state.tree.value[0].children[0].organizationType, null)
  assert.equal(state.saving.value, false)
  unmount()
})
test('保存成功刷新版本和树标签，清除时发送真实 null', async () => {
  const calls = []
  const { state, unmount } = mount({
    setOrganizationType: async (id, type, version) => {
      calls.push({ id, type, version })
      return success({ ...node(id, type ? { value: type, text: '项目' } : null), version: version + 1 })
    }
  })
  await settle()
  await state.select('park')
  await state.save('project')
  await state.save(null)
  assert.deepEqual(calls, [
    { id: 'park', type: 'project', version: 0 },
    { id: 'park', type: null, version: 1 }
  ])
  assert.equal(state.detail.value.version, 2)
  assert.equal(state.tree.value[0].children[0].organizationType, null)
  unmount()
})
test('冲突恢复显示其他人已保存的新标签并更新未标注筛选', async () => {
  let changed = false
  const { state, unmount } = mount({
    getOrganization: async (id) =>
      success({ ...node(id, changed ? { value: 'external', text: '外协单位' } : null), version: changed ? 1 : 0 }),
    setOrganizationType: async () => {
      changed = true
      throw new Error('409 conflict')
    }
  })
  await settle()
  await state.select('park')
  await state.save('project')
  assert.equal(state.detail.value.organizationType.value, 'external')
  assert.equal(state.tree.value[0].children[0].organizationType?.value, 'external')
  assert.equal(state.unmarkedCount.value, 0)
  unmount()
})
test('同步失败保留原树和最近成功时间', async () => {
  const { state, unmount } = mount({
    getOrganizationSyncStatus: async () => success({ running: false, lastSuccessTime: 123 }),
    synchronizeOrganizations: async () => {
      throw new Error('upstream unavailable')
    }
  })
  await settle()
  await state.synchronize()
  assert.equal(state.tree.value[0].name, 'company')
  assert.equal(state.status.value.lastSuccessTime, 123)
  assert.equal(state.syncing.value, false)
  unmount()
})
test('同步后选中组织失效时清空详情，阻止继续标注', async () => {
  const { state, unmount } = mount()
  await settle()
  await state.select('park')
  globalThis.__organizationTestApi.getOrganizationTree = async () => success([])
  await state.reload()
  assert.equal(state.selectedId.value, '')
  assert.equal(state.detail.value, undefined)
  assert.equal(state.detailLoading.value, false)
  assert.equal(state.editable.value, false)
  unmount()
})
