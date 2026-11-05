import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createRenderer, defineComponent, h, nextTick, ref } from 'vue'

const require = createRequire(import.meta.url)
const load = async (entry, mockApi = true) => {
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
              builder.onResolve({ filter: /api\/(user|organization)|@jetlinks-web|vue-i18n/ }, (args) => ({
                path: args.path,
                namespace: 'mock'
              }))
              builder.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({
                contents: args.path.includes('api/')
                  ? (args.path.includes('organization')
                      ? ['getOrganizationTree']
                      : [
                          'getPropertyUser',
                          'setUserIdentities',
                          'getUserIdentities',
                          'getUserSyncStatus',
                          'synchronizeUsers',
                          'queryPropertyUsers',
                          'countPropertyUsers'
                        ]
                    )
                      .map((name) => `export const ${name} = (...args) => globalThis.__userTestApi.${name}(...args)`)
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

const { useUserDetail } = await load('../hooks/useUserDetail.ts')
const { useUserSync } = await load('../hooks/useUserSync.ts')
const { useUserList } = await load('../hooks/useUserList.ts')
const { userTerms, organizationIds } = await load('../utils/userQuery.ts', false)
const success = (result) => ({ success: true, result })
const user = (id, identities = [], version = 0) => ({
  id,
  username: id,
  name: id,
  status: 1,
  orgList: [],
  identities: identities.map((value) => ({ value, text: value })),
  version
})
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
function mount(hook, api = {}, ...args) {
  globalThis.__userTestApi = {
    getPropertyUser: async (id) => success(user(id)),
    getUserSyncStatus: async () => success({ running: false, status: 'idle' }),
    getOrganizationTree: async () => success([]),
    getUserIdentities: async () =>
      success([
        { value: 'owner', text: 'Owner' },
        { value: 'employee', text: 'Employee' }
      ]),
    countPropertyUsers: async () => success({ all: 3, owner: 1, employee: 1, unmarked: 2 }),
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
        state = hook(...args)
        return () => h('div')
      }
    })
  )
  app.mount({})
  return { state, unmount: () => app.unmount() }
}

test('身份条件与 OR 搜索分组，双身份不互斥，未标记必须同时为 false', () => {
  assert.deepEqual(userTerms([{ column: 'name', termType: 'like', value: '%a%', type: 'or' }], 'owner'), [
    { terms: [{ column: 'name', termType: 'like', value: '%a%', type: 'or' }] },
    { column: 'owner', termType: 'eq', value: true }
  ])
  assert.deepEqual(userTerms([], 'unmarked'), [
    { column: 'owner', termType: 'eq', value: false },
    { column: 'employee', termType: 'eq', value: false }
  ])
  const tree = [{ id: 'a', children: [{ id: 'b', children: [{ id: 'c' }] }] }]
  assert.deepEqual(organizationIds(tree, 'a', true), ['a', 'b', 'c'])
  assert.deepEqual(organizationIds(tree, 'a', false), ['a'])
  assert.deepEqual(organizationIds(tree, 'missing', true), [])
})

test('双身份完整替换及全部取消都传最新版本，保存后详情保持打开', async () => {
  const calls = []
  let refreshes = 0
  const { state, unmount } = mount(
    useUserDetail,
    {
      setUserIdentities: async (id, values, version) => {
        calls.push({ id, values, version })
        return success(user(id, values, version + 1))
      }
    },
    () => refreshes++
  )
  await state.mark('a')
  await state.save(['owner', 'employee'])
  await state.save([])
  assert.deepEqual(calls, [
    { id: 'a', values: ['owner', 'employee'], version: 0 },
    { id: 'a', values: [], version: 1 }
  ])
  assert.equal(state.detail.value.version, 2)
  assert.equal(state.open.value, true)
  assert.equal(state.saved.value, true)
  assert.equal(refreshes, 2)
  unmount()
})

test('切换用户和关闭抽屉隔离旧详情响应', async () => {
  const gate = deferred()
  const { state, unmount } = mount(
    useUserDetail,
    { getPropertyUser: async (id) => (id === 'a' ? gate.promise : success(user(id))) },
    () => {}
  )
  const first = state.select('a')
  await state.select('b')
  gate.resolve(success(user('a')))
  await first
  assert.equal(state.detail.value.id, 'b')
  const late = deferred()
  globalThis.__userTestApi.getPropertyUser = () => late.promise
  const loading = state.select('c')
  state.close()
  late.resolve(success(user('c')))
  await loading
  assert.equal(state.open.value, false)
  assert.equal(state.detail.value, undefined)
  unmount()
})

test('保存旧用户时仍可浏览其他用户，旧保存不能覆盖新详情', async () => {
  const gate = deferred()
  let refreshes = 0
  const { state, unmount } = mount(useUserDetail, { setUserIdentities: () => gate.promise }, () => refreshes++)
  await state.mark('a')
  const save = state.save(['owner'])
  await state.select('b')
  assert.equal(state.editable.value, false)
  gate.resolve(success(user('a', ['owner'], 1)))
  await save
  assert.equal(state.detail.value.id, 'b')
  assert.equal(state.saved.value, false)
  assert.equal(refreshes, 1)
  unmount()
})

test('保存冲突读取最新版本且不自动重试，失败保留已保存身份', async () => {
  let writes = 0
  let reads = 0
  const { state, unmount } = mount(
    useUserDetail,
    {
      getPropertyUser: async (id) => success(user(id, ['owner'], reads++ ? 2 : 0)),
      setUserIdentities: async () => {
        writes++
        throw Error('conflict')
      }
    },
    () => {}
  )
  await state.mark('a')
  await state.save(['employee'])
  assert.equal(writes, 1)
  assert.equal(state.detail.value.version, 2)
  assert.equal(state.detail.value.identities[0].value, 'owner')
  assert.equal(state.saveError.value, true)
  assert.equal(state.readOnly.value, false)
  unmount()
})

test('停用账号只读，不发送标注请求', async () => {
  let writes = 0
  const { state, unmount } = mount(
    useUserDetail,
    {
      getPropertyUser: async (id) => success({ ...user(id), status: 0 }),
      setUserIdentities: async () => {
        writes++
        return success(user('a'))
      }
    },
    () => {}
  )
  await state.mark('a')
  await state.save(['owner'])
  assert.equal(state.editable.value, false)
  assert.equal(writes, 0)
  unmount()
})

test('详情只读且不能保存，标记入口可编辑，重试保留当前模式，再看详情恢复只读', async () => {
  let writes = 0
  const { state, unmount } = mount(
    useUserDetail,
    {
      setUserIdentities: async (id, identities) => {
        writes++
        return success(user(id, identities, 1))
      }
    },
    () => {}
  )
  await state.select('a')
  assert.equal(state.readOnly.value, true)
  assert.equal(state.editable.value, false)
  await state.save(['owner'])
  assert.equal(writes, 0)
  await state.retry()
  assert.equal(state.readOnly.value, true)
  await state.mark('a')
  assert.equal(state.editable.value, true)
  await state.retry()
  assert.equal(state.readOnly.value, false)
  await state.save(['owner'])
  assert.equal(writes, 1)
  await state.select('a')
  await state.save(['employee'])
  assert.equal(writes, 1)
  unmount()
})

test('同步任务完成后刷新，失败状态保留来源和标记，不误报成功', async () => {
  let completed = 0
  let current = { taskId: 't1', status: 'running', running: true }
  const { state, unmount } = mount(
    useUserSync,
    { getUserSyncStatus: async () => success(current), synchronizeUsers: async () => success(current) },
    () => completed++
  )
  await settle()
  current = { taskId: 't1', status: 'succeeded', running: false, lastSuccessTime: 100 }
  await state.refreshStatus()
  assert.equal(completed, 1)
  assert.equal(state.running.value, false)
  current = { taskId: 't2', status: 'running', running: true }
  await state.synchronize()
  current = { taskId: 't2', status: 'failed', running: false, lastSuccessTime: 100 }
  await state.refreshStatus()
  assert.equal(completed, 1)
  assert.equal(state.status.value.lastSuccessTime, 100)
  assert.equal(state.status.value.status, 'failed')
  unmount()
})

test('计数旧响应不能覆盖新筛选，归属筛选输出标准 exists 条件', async () => {
  const gate = deferred()
  let calls = 0
  const { state, unmount } = mount(useUserList, {
    countPropertyUsers: () =>
      ++calls === 1 ? gate.promise : Promise.resolve(success({ all: 1, owner: 1, employee: 0, unmarked: 0 })),
    getOrganizationTree: async () =>
      success([{ id: 'a', name: 'A', version: 0, children: [{ id: 'b', name: 'B', version: 0 }] }])
  })
  await settle()
  state.organizationId.value = 'a'
  await settle()
  gate.resolve(success({ all: 99, owner: 0, employee: 0, unmarked: 99 }))
  await settle()
  assert.equal(state.counts.value.all, 1)
  assert.deepEqual(state.params.value.terms, [
    { terms: [{ column: 'id', termType: 'property-user-org', value: { orgId$in: ['a', 'b'] } }] }
  ])
  state.includeChildren.value = false
  await settle()
  assert.deepEqual(state.params.value.terms[0].terms[0].value, { orgId$in: ['a'] })
  state.resetFilters()
  assert.deepEqual(state.searchTerms.value, [])
  assert.equal(state.organizationId.value, undefined)
  unmount()
})
