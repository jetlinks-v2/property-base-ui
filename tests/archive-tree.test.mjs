import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRenderer, defineComponent, h, nextTick } from 'vue'
import { parse, compileScript } from 'vue/compiler-sfc'
const require = createRequire(import.meta.url)

// 编译并挂载生产SFC，实际触发树事件，覆盖“模板创建了函数但没有执行”的回归。
async function loadComponent(path) {
  const filename = fileURLToPath(new URL(path, import.meta.url))
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
  const compiled = compileScript(descriptor, { id: 'tree-regression', inlineTemplate: true })
  const result = await build({
    stdin: {
      contents: compiled.content,
      loader: 'ts',
      resolveDir: fileURLToPath(new URL(path + '/../', import.meta.url))
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['vue'],
    plugins: [
      {
        name: 'platform',
        setup(builder) {
          builder.onResolve({ filter: /api\/(archive|organization)$|@jetlinks-web|vue-i18n|\.vue$/ }, (args) => ({
            path: args.path,
            namespace: 'platform'
          }))
          builder.onLoad({ filter: /.*/, namespace: 'platform' }, ({ path }) => ({
            contents: /api\/(archive|organization)$/.test(path)
              ? [
                  'getOrganizationTree',
                  'checked',
                  'getSpaceTree',
                  'spaceSyncStatus',
                  'syncSpaces',
                  'getDictionaryTypes',
                  'getDictionaryItems',
                  'deleteDictionaryItem',
                  'deleteDictionaryType',
                  'saveDictionaryItem',
                  'saveDictionaryType'
                ]
                  .map((name) => `export const ${name} = (...args) => globalThis.__treeApi.${name}(...args)`)
                  .join('\n')
              : path === 'vue-i18n'
              ? 'export const useI18n = () => ({t: key => key})'
              : path === '@jetlinks-web/hooks'
              ? 'export const usePermission = () => ({hasPerm: true})'
              : path === '@jetlinks-web/utils'
              ? 'export const onlyMessage = () => {}'
              : path === '@jetlinks-web-core/layout'
              ? 'export const FullPage = (_, {slots}) => slots.default?.()'
              : 'export default () => null'
          }))
        }
      }
    ]
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports)
  return module.exports.default
}

const Workspace = await loadComponent('../views/charging/components/ArchiveWorkspace.vue')
const Dictionary = await loadComponent('../views/charging/Dictionary/index.vue')
const ProjectSelect = await loadComponent('../components/ProjectSelect.vue')
const settle = async () => {
  await new Promise((resolve) => setImmediate(resolve))
  await nextTick()
}
function mount(component, api, props = {}) {
  globalThis.__treeApi = api
  let tree, table, projectSelect
  const scopes = []
  const node = () => ({ children: [], parent: null })
  const remove = (el) => {
    if (el.parent) {
      const siblings = el.parent.children
      siblings.splice(siblings.indexOf(el), 1)
      el.parent = null
    }
  }
  const renderer = createRenderer({
    createElement: node,
    createText: node,
    createComment: node,
    insert(el, parent, anchor) {
      remove(el)
      el.parent = parent
      const i = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(i < 0 ? parent.children.length : i, 0, el)
    },
    remove,
    setText() {},
    setElementText() {},
    patchProp() {},
    parentNode: (el) => el.parent,
    nextSibling: (el) => el.parent?.children[el.parent.children.indexOf(el) + 1] || null
  })
  const app = renderer.createApp({
    render: () =>
      h(component, props, {
        default: (value) => {
          scopes.push({ ...value.scope })
          return h('result')
        }
      })
  })
  const Pass = defineComponent({
    inheritAttrs: false,
    setup(_, { slots }) {
      return () => h('stub', null, slots.default?.())
    }
  })
  for (const name of [
    'j-page-container',
    'a-spin',
    'a-button',
    'a-input',
    'a-switch',
    'a-tag',
    'a-popconfirm',
    'a-space',
    'j-permission-button',
    'AIcon',
    'CloudEmpty'
  ])
    app.component(name, Pass)
  app.component(
    'a-tree-select',
    defineComponent({
      props: ['value', 'treeData', 'dropdownMatchSelectWidth', 'dropdownStyle'],
      emits: ['change'],
      setup(props, { emit }) {
        projectSelect = { props, select: (value) => emit('change', value) }
        return () => h('select')
      }
    })
  )
  app.component(
    'a-tree',
    defineComponent({
      props: ['selectedKeys', 'treeData'],
      emits: ['select'],
      setup(props, { emit }) {
        tree = { props, select: (keys) => emit('select', keys) }
        return () => h('tree')
      }
    })
  )
  app.component(
    'j-pro-table',
    defineComponent({
      props: ['request'],
      setup(props, { expose }) {
        table = props
        expose({ reload() {} })
        return () => h('table')
      }
    })
  )
  app.mount(node())
  return { tree: () => tree, table: () => table, projectSelect: () => projectSelect, scopes, unmount: () => app.unmount() }
}

test('公共项目选择可供业务模块使用：禁止非项目，项目发出更新事件，下拉宽度随内容展开', async (t) => {
  const values = []
  const view = mount(ProjectSelect, {}, {
    value: 'project-a',
    treeData: [{
      value: 'company', title: '公司', disabled: true,
      children: [
        { value: 'project-a', title: '项目一', disabled: false, children: [] },
        { value: 'project-b', title: '项目二', disabled: false, children: [] }
      ]
    }],
    'onUpdate:value': (value) => values.push(value)
  })
  t.after(view.unmount)
  view.projectSelect().select('company')
  view.projectSelect().select('missing')
  assert.deepEqual(values, [])
  view.projectSelect().select('project-b')
  assert.deepEqual(values, ['project-b'])
  assert.equal(view.projectSelect().props.dropdownMatchSelectWidth, false)
  assert.equal(view.projectSelect().props.dropdownStyle.width, 'max-content')
})

test('空间和客户共用树：选中房屋保持高亮并向右侧传递所选空间范围，清空恢复项目范围', async (t) => {
  const view = mount(Workspace, {
    checked: (response) => response.result,
    getOrganizationTree: async () => ({
      result: [{ id: 'project', name: '园区', organizationType: { value: 'project', text: '项目' } }]
    }),
    getSpaceTree: async () => [
      {
        id: 'root',
        name: '园区',
        leaf: false,
        children: [
          { id: '101', name: '101', leaf: true },
          { id: '102', name: '102', leaf: true }
        ]
      }
    ],
    spaceSyncStatus: async () => ({ running: false })
  })
  t.after(view.unmount)
  await settle()
  await settle()
  view.tree().select(['101'])
  await settle()
  assert.deepEqual(view.tree().props.selectedKeys, ['101'])
  assert.deepEqual(view.scopes.at(-1), { projectId: 'project', spaceId: '101' })
  view.tree().select([102])
  await settle()
  assert.deepEqual(view.tree().props.selectedKeys, ['102'])
  assert.equal(view.scopes.at(-1).spaceId, '102')
  view.tree().select([])
  await settle()
  assert.deepEqual(view.tree().props.selectedKeys, [])
  assert.equal(view.scopes.at(-1).spaceId, undefined)
  view.unmount()
})

test('字典树：点击分类更新选中项、查询对应选项并更新右表；再次点击保留当前分类', async (t) => {
  const calls = []
  const view = mount(Dictionary, {
    getDictionaryTypes: async () => [
      { code: 'house-type', name: '房屋类型', enabled: true },
      { code: 'house-state', name: '房态', enabled: true }
    ],
    getDictionaryItems: async (code) => {
      calls.push(code)
      return [{ id: code, text: code }]
    }
  })
  t.after(view.unmount)
  await settle()
  await settle()
  assert.deepEqual(calls, ['house-type'])
  view.tree().select(['house-state'])
  await settle()
  assert.deepEqual(view.tree().props.selectedKeys, ['house-state'])
  assert.deepEqual(calls, ['house-type', 'house-state'])
  assert.equal((await view.table().request({ pageIndex: 0, pageSize: 12 })).result.data[0].id, 'house-state')
  view.tree().select([])
  await settle()
  assert.deepEqual(view.tree().props.selectedKeys, ['house-state'])
  assert.equal(calls.length, 2)
  view.unmount()
})

test('字典选项分页保留全部总数，切页不重复，切换分类使用新选项', async (t) => {
  const view = mount(Dictionary, {
    getDictionaryTypes: async () => [
      { code: 'many', name: '多选项', enabled: true },
      { code: 'other', name: '其他', enabled: true }
    ],
    getDictionaryItems: async (code) =>
      Array.from({ length: code === 'many' ? 25 : 2 }, (_, i) => ({ id: `${code}-${i}`, sortIndex: i }))
  })
  t.after(view.unmount)
  await settle()
  await settle()
  const page = (pageIndex, pageSize = 12) =>
    view
      .table()
      .request({ pageIndex, pageSize })
      .then((r) => r.result)
  assert.equal((await page(0)).total, 25)
  assert.equal((await page(0)).data.length, 12)
  assert.equal((await page(1)).data[0].id, 'many-12')
  assert.deepEqual(
    (await page(2)).data.map((item) => item.id),
    ['many-24']
  )
  assert.equal((await page(1, 24)).data[0].id, 'many-24')
  view.tree().select(['other'])
  await settle()
  assert.equal((await page(0)).total, 2)
  assert.equal((await page(0)).data[0].id, 'other-0')
})
