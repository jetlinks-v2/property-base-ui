import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createRenderer, defineComponent, h, nextTick, ref } from 'vue'
const require = createRequire(import.meta.url)
async function load(entry, apiNames = []) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(entry, import.meta.url))],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['vue'],
    plugins: apiNames.length
      ? [
          {
            name: 'archive-api',
            setup(builder) {
              builder.onResolve(
                { filter: /api\/(archive|user|organization)|@jetlinks-web|@vueuse\/core|vue-i18n/ },
                (args) => ({
                  path: args.path,
                  namespace: 'mock'
                })
              )
              builder.onLoad({ filter: /.*/, namespace: 'mock' }, (args) => ({
                contents: /api\/(archive|user|organization)/.test(args.path)
                  ? apiNames
                      .map((name) => `export const ${name} = (...args) => globalThis.__archiveApi.${name}(...args)`)
                      .join('\n')
                  : args.path === '@vueuse/core'
                  ? 'export const useDebounceFn = fn => fn'
                  : args.path === 'vue-i18n'
                  ? 'export const useI18n = () => ({t: key => key, tm: () => ({spaceId: "空间标识", houseType: "房屋类型", houseState: "房态", billingArea: "计费面积"})})'
                  : 'export const onlyMessage = (message, type) => globalThis.__archiveMessages?.push({message, type}); export const downloadFileByUrl = (...args) => globalThis.__archiveDownloads?.push(args)'
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
const customer = await load('../utils/customer.ts')
const errors = await load('../utils/requestError.ts')
const importValues = await load('../utils/archiveImport.ts')
const history = await load('../utils/historyQuery.ts')
const organizationSpaces = await load('../hooks/archive/useOrganizationSpaces.ts', [
  'getSpaceRoots',
  'getSpaceRootTree',
  'bindSpaceRoot',
  'syncSpaces'
])
const scopeModule = await load('../hooks/archive/useArchiveScope.ts', [
  'getOrganizationTree',
  'checked',
  'getSpaceTree',
  'spaceSyncStatus',
  'syncSpaces'
])
const dictionaryModule = await load('../hooks/archive/useDictionaries.ts', ['getDictionaryTypes', 'getDictionaryItems'])
const houseModule = await load('../hooks/archive/useHouseEditor.ts', ['getHouse', 'saveHouse'])
const houseQueryModule = await load('../hooks/archive/useHouseQuery.ts')
const customerListModule = await load('../hooks/archive/useCustomerList.ts', [
  'getHouse', 'checked', 'queryCustomers', 'queryHistory'
])
const customerDetailModule = await load('../hooks/archive/useCustomerDetail.ts', [
  'getCustomer',
  'saveCustomer',
  'deleteRelationship'
])
const customerCreateModule = await load('../hooks/archive/useCustomerCreate.ts', [
  'addRelationship',
  'checked',
  'createCustomer',
  'queryCustomerProfiles',
  'queryPropertyUsers'
])
const excelModule = await load('../hooks/archive/useArchiveExcel.ts', [
  'getArchiveTemplate',
  'exportCustomers',
  'exportHouses',
  'importCustomers',
  'importHouses',
  'getDictionaryItems',
  'getDictionaryTypes',
  'checked',
  'queryHouses',
  'queryPropertyUsers'
])
const settle = async () => {
  await new Promise((resolve) => setImmediate(resolve))
  await nextTick()
}
function deferred() {
  let resolve
  const promise = new Promise((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}
function mount(create, api = {}) {
  globalThis.__archiveApi = api
  globalThis.__archiveMessages = []
  let state
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
  const app = renderer.createApp(
    defineComponent({
      setup() {
        state = create()
        return () => h('div')
      }
    })
  )
  app.mount({})
  return { state, unmount: () => app.unmount() }
}

test('非末级空间通过已完善资料判定客户关联资格，未完善不能关联', async () => {
  for (const completed of [true, false]) {
    const calls = []
    const mounted = mount(
      () => customerListModule.useCustomerList({ projectId: 'project', spaceId: 'building' },
        { id: 'building', name: '1栋', leaf: false, version: 0 }),
      { getHouse: async (scope, id) => { calls.push(id); return { completed } } }
    )
    await settle()
    assert.deepEqual(calls, ['building'])
    assert.equal(mounted.state.houseCompleted.value, completed)
    assert.equal(mounted.state.houseFailed.value, false)
    mounted.unmount()
  }
})

test('空间资料快捷切换保留搜索分组，全部解除状态限制，导出使用相同条件', () => {
  const state = houseQueryModule.useHouseQuery()
  assert.deepEqual(state.params.value.terms, [])
  const search = [
    { column: 'name', termType: 'like', value: '%101%' },
    { column: 'name', termType: 'like', value: '%102%', type: 'or' }
  ]
  state.change({ filter: { terms: search } })
  state.completion.value = 'incomplete'
  assert.deepEqual(state.params.value.terms, [
    { terms: search }, { column: 'completed', termType: 'eq', value: false }
  ])
  state.completion.value = 'complete'
  assert.equal(state.params.value.terms[1].value, true)
  state.completion.value = 'all'
  assert.deepEqual(state.params.value.terms, [{ terms: search }])
  state.change({ filter: { terms: [] } })
  assert.deepEqual(state.params.value.terms, [])
})

test('空间资料请求失败保持禁止关联，离开后旧响应不恢复资格', async () => {
  const old = deferred()
  const mounted = mount(
    () => customerListModule.useCustomerList({ projectId: 'project' }, { id: 'building', leaf: false }),
    { getHouse: async () => old.promise }
  )
  mounted.unmount()
  old.resolve({ completed: true })
  await settle()
  assert.equal(mounted.state.houseCompleted.value, false)
  const failed = mount(
    () => customerListModule.useCustomerList({ projectId: 'project' }, { id: 'building', leaf: false }),
    { getHouse: async () => { throw new Error('denied') } }
  )
  await settle()
  assert.equal(failed.state.houseFailed.value, true)
  assert.equal(failed.state.houseCompleted.value, false)
  failed.unmount()
})
test('客户请求展示业务响应，HTTP或网络异常无业务提示时使用页面文案', () => {
  const transport = Object.assign(new Error('Network Error'), { isAxiosError: true })
  assert.equal(errors.requestErrorMessage(transport, '保存失败，请重试'), '保存失败，请重试')
  assert.equal(
    errors.requestErrorMessage(
      { response: { data: { message: '该用户在当前项目已建档，请关联已有客户' } } },
      '保存失败'
    ),
    '该用户在当前项目已建档，请关联已有客户'
  )
  assert.equal(errors.requestErrorMessage(new Error('请选择客户'), '保存失败'), '请选择客户')
})

test('客户列表编辑读取最新资料，业务错误显示后端中文，关闭后旧响应不重开编辑', async () => {
  const late = deferred()
  const row = {
    id: 'client',
    customerType: 'person',
    name: '姓名',
    telephone: '123',
    version: 2,
    relationships: [{ id: 'record', nature: 'owner', version: 0 }]
  }
  const { state, unmount } = mount(() => customerDetailModule.useCustomerDetail({ projectId: 'project' }, () => {}), {
    getCustomer: async (_scope, id) => (id === 'late' ? late.promise : row),
    saveCustomer: async () => {
      throw Object.assign(new Error('Request failed with status code 409'), {
        isAxiosError: true,
        response: { data: { message: '资料已变化，请刷新后重试' } }
      })
    }
  })
  await state.select('client', undefined, 'edit')
  assert.equal(state.editing.value, true)
  assert.equal(state.profile.name, '姓名')
  await state.save()
  assert.deepEqual(globalThis.__archiveMessages.at(-1), { message: '资料已变化，请刷新后重试', type: 'error' })
  const pending = state.select('late', undefined, 'edit')
  state.close()
  late.resolve({ ...row, id: 'late' })
  await pending
  assert.equal(state.open.value, false)
  assert.equal(state.editing.value, false)
  unmount()
})

test('客户编辑失败重试保留选中的空间记录及模式', async () => {
  let fail = true
  const first = { id: 'first', nature: 'owner', version: 1 }
  const second = { id: 'second', nature: 'tenant', version: 2 }
  const { state, unmount } = mount(() => customerDetailModule.useCustomerDetail({ projectId: 'project' }, () => {}), {
    getCustomer: async () => {
      if (fail) throw new Error('网络失败')
      return {
        id: 'client',
        customerType: 'person',
        name: '姓名',
        telephone: '123',
        version: 1,
        relationships: [first, second]
      }
    }
  })
  await state.select('client', second, 'edit')
  assert.equal(state.failed.value, true)
  fail = false
  await state.retry()
  assert.equal(state.editing.value, true)
  assert.equal(state.record.value.id, 'second')
  assert.equal(state.relation.nature, 'tenant')
  unmount()
})

test('删除按当前空间记录提交版本，其他空间不受影响，历史详情只读', async () => {
  const removed = []
  let reloads = 0
  const selected = { id: '101-client', spaceId: '101', nature: 'owner', version: 3 }
  const row = {
    id: 'client',
    customerType: 'person',
    name: '张三',
    telephone: '123',
    version: 2,
    relationships: [selected, { id: '102-client', spaceId: '102', nature: 'tenant', version: 1 }]
  }
  const { state, unmount } = mount(
    () => customerDetailModule.useCustomerDetail({ projectId: 'project' }, () => reloads++),
    {
      getCustomer: async () => row,
      deleteRelationship: async (scope, value) => removed.push({ scope, value })
    }
  )
  await state.select('client', selected)
  assert.equal(state.record.value.id, '101-client')
  await state.removeRelation(selected)
  assert.deepEqual(removed[0].value, selected)
  assert.equal(reloads, 1)
  await state.select('client', { ...selected, customer: row, endTime: 100 }, 'view', true)
  await state.removeRelation(selected)
  await state.save()
  assert.equal(removed.length, 1)
  assert.equal(state.editing.value, false)
  unmount()
})

test('编辑提交资料版本及选中空间性质，详情只读不保存', async () => {
  const calls = []
  const selected = { id: '101-client', spaceId: '101', nature: 'owner', version: 3 }
  const row = {
    id: 'client',
    customerType: 'person',
    name: '张三',
    telephone: '123',
    version: 2,
    relationships: [selected]
  }
  const { state, unmount } = mount(() => customerDetailModule.useCustomerDetail({ projectId: 'project' }, () => {}), {
    getCustomer: async () => row,
    saveCustomer: async (...args) => calls.push(args)
  })
  await state.select('client', selected)
  await state.save()
  assert.equal(calls.length, 0)
  await state.select('client', selected, 'edit')
  state.relation.nature = 'tenant'
  await state.save()
  assert.equal(calls[0][2].relationshipId, '101-client')
  assert.equal(calls[0][2].relationshipVersion, 3)
  assert.equal(calls[0][2].version, 2)
  assert.equal(calls[0][2].nature, 'tenant')
  assert.equal(state.open.value, false)
  unmount()
})

test('新建选择用户前字段禁用，来源有值锁定，缺失允许补充，已有客户仍可新增', async () => {
  const calls = []
  const existing = { id: 'existing', customerType: 'person', name: '已保存姓名', telephone: '138', relationships: [] }
  const { state, unmount } = mount(
    () => customerCreateModule.useCustomerCreate({ projectId: 'project', spaceId: '101' }, () => {}),
    {
      checked: (value) => value.result,
      queryPropertyUsers: async () => ({
        result: { data: [{ id: 'user', name: '张三', telephone: '', email: 'source@example.com' }], total: 1 }
      }),
      queryCustomerProfiles: async () => ({ result: { data: [existing], total: 1 } }),
      addRelationship: async (...args) => calls.push(args),
      createCustomer: async (...args) => calls.push(args)
    }
  )
  assert.deepEqual(state.lockedFields.value, { name: true, telephone: true, email: true })
  await settle()
  state.userId.value = 'user'
  await settle()
  assert.equal(state.profile.name, '张三')
  assert.deepEqual(state.lockedFields.value, { name: true, telephone: false, email: true })
  state.users.value = []
  assert.deepEqual(state.lockedFields.value, { name: true, telephone: false, email: true })
  state.profile.telephone = '138'
  state.relation.nature = 'owner'
  await state.save()
  assert.equal(calls[0][1].telephone, '138')
  assert.equal('startTime' in calls[0][1], false)
  state.mode.value = 'existing'
  await settle()
  state.customerId.value = 'existing'
  state.relation.nature = 'tenant'
  await settle()
  await state.save()
  assert.deepEqual(calls[1], [
    { projectId: 'project', spaceId: '101' },
    'existing',
    { spaceId: '101', nature: 'tenant' }
  ])
  unmount()
})

test('个人企业请求均不提交家庭或手工时间，企业不提交个人字段', () => {
  const data = customer.createPayload(
    'user',
    'company',
    { name: ' 企业 ', telephone: ' 001 ', certificateType: 'id' },
    { spaceId: '101', nature: 'owner', familyName: 'unused', startTime: 12 }
  )
  assert.equal(data.name, '企业')
  assert.equal(data.telephone, '001')
  for (const field of ['certificateType', 'nature', 'familyName', 'startTime']) assert.equal(field in data, false)
  assert.deepEqual(
    customer.relationshipPayload({ spaceId: '102', nature: 'tenant', startTime: 12, familyId: 'unused' }, 'person'),
    { spaceId: '102', nature: 'tenant' }
  )
})

test('历史筛选递归映射主档字段但保留关系性质与逻辑，排序使用同一契约', () => {
  const query = {
    terms: [
      {
        terms: [
          { column: 'name', termType: 'like', value: '%A%' },
          { column: 'telephone', termType: 'eq', value: '001', type: 'or' }
        ],
        type: 'and'
      },
      { column: 'nature', termType: 'eq', value: 'tenant' }
    ],
    sorts: [{ name: 'customerType', order: 'asc' }]
  }
  const result = history.historyQuery(query)
  assert.equal(result.terms[0].terms[0].column, 'customer.name')
  assert.equal(result.terms[0].terms[1].column, 'customer.telephone')
  assert.equal(result.terms[0].terms[1].type, 'or')
  assert.equal(result.terms[1].column, 'nature')
  assert.equal(result.sorts[0].name, 'customer.customerType')
  assert.equal(query.terms[0].terms[0].column, 'name')
})
test('权限裁剪导致无可见子项时仍遵守来源leaf=false', () => {
  const result = scopeModule.filterSpaces(
    [{ id: 'building', name: 'Building', version: 0, leaf: false, children: [] }],
    ''
  )
  assert.equal(result[0].leaf, false)
})
test('切换项目后忽略旧空间树，不能把上个项目房屋带进新范围', async () => {
  const old = deferred()
  const { state, unmount } = mount(scopeModule.useArchiveScope, {
    checked: (response) => response.result,
    getOrganizationTree: async () => ({
      result: [
        { id: 'a', name: 'A', organizationType: { value: 'project', text: '项目' } },
        { id: 'b', name: 'B', organizationType: { value: 'project', text: '项目' } }
      ]
    }),
    getSpaceTree: (id) =>
      id === 'a' ? old.promise : Promise.resolve([{ id: 'b-house', name: 'B house', leaf: true, version: 0 }]),
    spaceSyncStatus: async () => ({ running: false })
  })
  await settle()
  state.projectId.value = 'b'
  await settle()
  old.resolve([{ id: 'a-house', name: 'A house', leaf: true, version: 0 }])
  await settle()
  assert.equal(state.tree.value[0].id, 'b-house')
  assert.equal(state.selectedId.value, undefined)
  unmount()
})

test('项目选择保留组织层级，仅项目可选，父节点禁用不影响下级项目', async () => {
  const source = [
    {
      id: 'company',
      name: '公司',
      children: [
        {
          id: 'external',
          name: '外协单位',
          organizationType: { value: 'external', text: '外协单位' },
          children: [{ id: 'park', name: '园区', organizationType: { value: 'project', text: '项目' } }]
        },
        { id: 'second', name: '二期', organizationType: { value: 'project', text: '项目' } }
      ]
    }
  ]
  const requests = []
  const { state, unmount } = mount(scopeModule.useArchiveScope, {
    checked: (response) => response.result,
    getOrganizationTree: async () => ({ result: source }),
    getSpaceTree: async (id) => {
      requests.push(id)
      return []
    },
    spaceSyncStatus: async () => ({ running: false })
  })
  await settle()
  const root = state.projectTree.value[0]
  assert.equal(root.title, '公司')
  assert.equal(root.disabled, true)
  assert.equal(root.children[0].disabled, true)
  assert.equal(root.children[0].children[0].disabled, false)
  assert.equal(root.children[1].disabled, false)
  assert.deepEqual(
    state.projects.value.map((node) => node.id),
    ['park', 'second']
  )
  assert.equal(state.projectId.value, 'park')
  state.selectProject('company')
  state.selectProject('external')
  await settle()
  assert.deepEqual(requests, ['park'])
  state.selectProject('second')
  await settle()
  assert.equal(state.scope.value.projectId, 'second')
  assert.deepEqual(requests, ['park', 'second'])
  unmount()
})

test('组织类型变更后清空失效项目，组织查询失败可刷新重试', async () => {
  let nodes = [
    {
      id: 'company',
      name: '公司',
      children: [{ id: 'park', name: '园区', organizationType: { value: 'project', text: '项目' } }]
    }
  ]
  let failed = true
  const { state, unmount } = mount(scopeModule.useArchiveScope, {
    checked: (response) => {
      if (!response.success) throw new Error('查询失败')
      return response.result
    },
    getOrganizationTree: async () => ({ success: !failed, result: structuredClone(nodes) }),
    getSpaceTree: async () => [],
    spaceSyncStatus: async () => ({ running: false })
  })
  await settle()
  assert.equal(state.failed.value, true)
  assert.equal(state.projectId.value, '')
  failed = false
  await state.loadProjects()
  await settle()
  assert.equal(state.projectId.value, 'park')
  nodes[0].children[0].organizationType = { value: 'external', text: '外协单位' }
  await state.loadProjects()
  await settle()
  assert.equal(state.projectId.value, '')
  assert.deepEqual(state.tree.value, [])
  assert.equal(state.projectTree.value[0].children[0].disabled, true)
  unmount()
})
test('字典分类停用后不可新增选择，旧记录仍可解析原文或原编码', async () => {
  const { state, unmount } = mount(dictionaryModule.useDictionaries, {
    getDictionaryTypes: async () => [{ id: 'type', code: 'house-type', enabled: false }],
    getDictionaryItems: async () => [{ id: 'item', value: '01', text: 'Old type', enabled: true }]
  })
  await settle()
  assert.deepEqual(state.options('house-type'), [])
  assert.equal(state.options('house-type', '01')[0].disabled, true)
  assert.equal(state.text('house-type', '01'), 'Old type')
  assert.equal(state.text('house-type', 'unknown'), 'unknown')
  unmount()
})
test('详情关闭后房屋保存旧响应不重开抽屉或刷新已离开的范围', async () => {
  const pending = deferred()
  let reloads = 0
  const { state, unmount } = mount(() => houseModule.useHouseEditor({ projectId: 'p' }, () => reloads++), {
    getHouse: async (id) => ({ id, spaceId: 'h', name: 'House', version: 2 }),
    saveHouse: () => pending.promise
  })
  await state.select('h')
  const saving = state.save({ houseType: 'type', houseState: 'state', billingArea: 12 })
  state.close()
  pending.resolve({ spaceId: 'h', name: 'House', version: 3 })
  await saving
  assert.equal(state.open.value, false)
  assert.equal(state.house.value, undefined)
  assert.equal(reloads, 0)
  unmount()
})
test('查询房屋详情的只读模式不能触发保存', async () => {
  let writes = 0
  const { state, unmount } = mount(() => houseModule.useHouseEditor({ projectId: 'p' }, () => {}), {
    getHouse: async () => ({ spaceId: 'h', name: 'House', version: 1 }),
    saveHouse: async () => {
      writes++
      return {}
    }
  })
  await state.select('h', true)
  await state.save({ houseType: 'type', houseState: 'state', billingArea: 1 })
  assert.equal(state.readOnly.value, true)
  assert.equal(writes, 0)
  unmount()
})
test('根空间兼容NON_NULL省略parentId但排除非根，解绑显式传null与版本', async () => {
  const calls = []
  const { state, unmount } = mount(
    () =>
      organizationSpaces.useOrganizationSpaces(
        () => 'org',
        () => 'project'
      ),
    {
      getSpaceRoots: async () => [
        { id: 'omitted', name: 'Root', version: 4 },
        { id: 'null', name: 'Root null', parentId: null, version: 2 },
        { id: 'child', name: 'Child', parentId: 'omitted', version: 1 }
      ],
      bindSpaceRoot: async (...args) => {
        calls.push(args)
        return {}
      }
    }
  )
  await settle()
  assert.deepEqual(
    state.options.value.map((item) => item.value),
    ['omitted', 'null']
  )
  await state.save({ id: 'omitted', version: 4 }, true)
  assert.deepEqual(calls, [['omitted', null, 4]])
  unmount()
})
test('组织已关联时不能追加第二个根，显式解除后才可关联新根', async () => {
  const rows = [
    { id: 'first', name: 'First', version: 2, organizationId: 'org' },
    { id: 'second', name: 'Second', version: 0 }
  ]
  const writes = []
  const { state, unmount } = mount(
    () =>
      organizationSpaces.useOrganizationSpaces(
        () => 'org',
        () => 'project'
      ),
    {
      getSpaceRoots: async () => rows.map((row) => ({ ...row })),
      bindSpaceRoot: async (id, organizationId, version) => {
        writes.push([id, organizationId, version])
        Object.assign(
          rows.find((row) => row.id === id),
          { organizationId, version: version + 1 }
        )
      }
    }
  )
  await settle()
  state.openEditor()
  state.selected.value = 'second'
  await state.bind()
  assert.equal(writes.length, 0)
  assert.equal(state.bound.value.length, 1)
  assert.equal(state.canBind.value, false)
  assert.equal(state.editing.value, false)
  await state.save(state.bound.value[0], true)
  state.openEditor()
  assert.equal(state.editing.value, true)
  state.selected.value = 'second'
  await state.bind()
  assert.deepEqual(writes, [
    ['first', null, 2],
    ['second', 'org', 0]
  ])
  assert.equal(state.bound.value[0].id, 'second')
  assert.equal(state.editing.value, false)
  unmount()
})

test('关联冲突不覆盖原关联，查看空间树使用当前根且失败可重试', async () => {
  let attempts = 0
  const { state, unmount } = mount(
    () =>
      organizationSpaces.useOrganizationSpaces(
        () => 'org',
        () => 'project'
      ),
    {
      getSpaceRoots: async () => [{ id: 'first', name: 'First', version: 2, organizationId: 'org' }],
      bindSpaceRoot: async () => {
        throw new Error('Conflict')
      },
      getSpaceRootTree: async (rootId) => {
        assert.equal(rootId, 'first')
        if (++attempts === 1) throw new Error('Unavailable')
        return [{ id: rootId, name: 'First', children: [{ id: 'room', name: '101' }] }]
      }
    }
  )
  await settle()
  state.openEditor()
  await state.save(state.bound.value[0], true)
  assert.equal(state.bound.value[0].id, 'first')
  assert.deepEqual(globalThis.__archiveMessages.at(-1), { message: 'Conflict', type: 'error' })
  assert.equal(state.editing.value, false)
  await state.preview()
  assert.equal(state.treeFailed.value, true)
  await state.preview()
  assert.equal(state.treeFailed.value, false)
  assert.equal(state.tree.value[0].children[0].id, 'room')
  unmount()
})

test('未标注和外协单位不能打开关联或提交绑定，切换项目后才可关联', async () => {
  const type = ref()
  const editable = ref(true)
  const writes = []
  const { state, unmount } = mount(
    () =>
      organizationSpaces.useOrganizationSpaces(
        () => 'org',
        () => type.value,
        () => editable.value
      ),
    {
      getSpaceRoots: async () => [{ id: 'root', name: 'Root', version: 0 }],
      bindSpaceRoot: async (...args) => {
        writes.push(args)
      }
    }
  )
  assert.equal(state.canBind.value, false)
  await settle()
  for (const value of [undefined, 'external']) {
    type.value = value
    assert.equal(state.canBind.value, false)
    state.openEditor()
    assert.equal(state.editing.value, false)
    state.selected.value = 'root'
    await state.bind()
    await state.save(state.roots.value[0])
    assert.equal(writes.length, 0)
  }
  type.value = 'project'
  editable.value = false
  assert.equal(state.canBind.value, false)
  editable.value = true
  assert.equal(state.canBind.value, true)
  state.openEditor()
  assert.equal(state.editing.value, true)
  state.selected.value = 'root'
  await state.bind()
  assert.deepEqual(writes, [['root', 'org', 0]])
  unmount()
})

test('Excel文件格式与10MB限制有效，拒绝CSV与超限文件', () => {
  assert.equal(importValues.validateImportFile({ name: '模板.XLSX', size: 10 * 1024 * 1024 }), undefined)
  assert.equal(importValues.validateImportFile({ name: '模板.xls', size: 1 }), undefined)
  assert.equal(importValues.validateImportFile({ name: '模板.csv', size: 1 }), 'format')
  assert.equal(importValues.validateImportFile({ name: '模板.xlsx', size: 10 * 1024 * 1024 + 1 }), 'size')
})
test('房屋保存冲突保留输入窗口并使用后端中文消息', async () => {
  const { state, unmount } = mount(() => houseModule.useHouseEditor({ projectId: 'project' }, () => {}), {
    getHouse: async () => ({ spaceId: '101', name: '101', version: 1 }),
    saveHouse: async () => {
      throw { response: { data: { message: '资料已变化，请刷新后重试' } } }
    }
  })
  await state.select('101')
  await state.save({ billingArea: 100 })
  assert.equal(state.open.value, true)
  assert.deepEqual(globalThis.__archiveMessages.at(-1), { message: '资料已变化，请刷新后重试', type: 'error' })
  unmount()
})

test('后端文件导入保留原文件和外部项目，行号错误只弹消息且不刷新', async () => {
  const calls = []
  let imported = 0
  const file = {
    name: '客户.xlsx',
    size: 128,
    arrayBuffer: () => {
      throw new Error('前端不应解析 Excel')
    }
  }
  const api = {
    importHouses: async (...args) => {
      calls.push(args)
      return { count: 2 }
    }
  }
  const { state, unmount } = mount(
    () =>
      excelModule.useArchiveExcel(
        () => ({ kind: 'house', scope: { projectId: 'p1', spaceId: 'subtree' }, query: {} }),
        () => imported++
      ),
    api
  )
  assert.equal(await state.upload(file), true)
  assert.deepEqual(calls[0], [{ projectId: 'p1' }, file])
  assert.equal(imported, 1)
  api.importHouses = async () => {
    throw { response: { data: { message: '第3行：房屋类型无效' } } }
  }
  assert.equal(await state.upload(file), false)
  assert.deepEqual(globalThis.__archiveMessages.at(-1), { message: '第3行：房屋类型无效', type: 'error' })
  assert.equal(imported, 1)
  assert.equal('error' in state, false)
  assert.equal(state.busy.value, false)
  unmount()
})

const files = await load('../utils/archiveFiles.ts')
test('客户下载与导入必须选择类型，类型传给后端且缺失时不发请求', async (t) => {
  const calls = []
  const { state, unmount } = mount(
    () =>
      excelModule.useArchiveExcel(
        () => ({ kind: 'customer', scope: { projectId: 'project' }, query: {} }),
        () => {}
      ),
    {
      getArchiveTemplate: async (...args) => {
        calls.push(args)
        throw new Error('download test')
      },
      importCustomers: async (...args) => {
        calls.push(args)
        return { count: 1 }
      }
    }
  )
  t.after(unmount)
  await state.template()
  assert.equal(await state.upload({ name: '客户.xlsx', size: 1 }), false)
  assert.equal(calls.length, 0)
  assert.equal(globalThis.__archiveMessages.at(-1).message, 'Archive.importTypeRequired')
  await state.template('company')
  assert.deepEqual(calls[0], [{ projectId: 'project' }, 'customer', 'company'])
  const file = { name: '个人.xlsx', size: 1 }
  assert.equal(await state.upload(file, 'person'), true)
  assert.deepEqual(calls[1], [{ projectId: 'project' }, file, 'person'])
})
test('下载失败的JSON Blob保留后端业务消息，不能当成Excel下载', async () => {
  const blob = new Blob([JSON.stringify({ message: '当前项目无权访问' })], { type: 'application/json' })
  await assert.rejects(files.excelResponse(blob), /当前项目无权访问/)
  assert.equal(await files.excelErrorMessage({ response: { data: blob } }, '下载失败'), '当前项目无权访问')
  const excelBlob = new Blob(['xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  assert.equal(await files.excelResponse(excelBlob), excelBlob)
  assert.equal(await files.excelErrorMessage({ response: { data: new Blob(['bad']) } }, '下载失败'), '下载失败')
})
