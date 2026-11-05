import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const host = resolve(root, '../..')

// 用真实模块入口、宿主菜单收集器和路由转换函数；仅替代 Vite glob 与浏览器依赖。
async function load(path, globs = {}) {
  globalThis.__propertyGlobs = globs
  const result = await build({
    entryPoints: [path],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    plugins: [{
      name: 'runtime',
      setup(builder) {
        builder.onResolve({ filter: /^@jetlinks-web\/utils$/ }, () => ({
          path: resolve(host, 'node_modules/@jetlinks-web/utils/src/config.ts')
        }))
        builder.onResolve({ filter: /^@jetlinks-web-core\/utils\/module-registry$|^@jetlinks-web\/core$|\.vue$/ }, ({ path }) => ({ path, namespace: 'browser' }))
        builder.onLoad({ filter: /.*/, namespace: 'browser' }, ({ path }) => ({
          contents: path.endsWith('.vue')
            ? 'export default {name: "PublicComponent"}'
            : path.includes('module-registry')
              ? 'export const moduleRegistry = globalThis.__propertyRegistry'
              : 'export const request = globalThis.__propertyRequest'
        }))
        builder.onLoad({ filter: /(?:index|modules)\.ts$/ }, ({ path }) => ({
          contents: readFileSync(path, 'utf8').replaceAll('import.meta.glob', 'globalThis.__propertyGlob'),
          loader: 'ts',
          resolveDir: dirname(path)
        }))
      }
    }]
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports)
  return module.exports
}

test('宿主独立收集公共菜单和页面，收费不再重复发布；公共资源通过宿主请求实例执行', async () => {
  const resources = new Map()
  const requests = []
  globalThis.__propertyRegistry = { register: (name, value) => resources.set(name, value) }
  globalThis.__propertyRequest = {
    get: async (...args) => {
      requests.push(args)
      return { success: true, result: [{ id: 'organization', name: '园区' }] }
    }
  }
  globalThis.__propertyGlob = (pattern) => globalThis.__propertyGlobs[pattern] || {}
  const views = Object.fromEntries(
    readdirSync(resolve(root, 'views'), { recursive: true })
      .map((path) => path.replaceAll('\\', '/'))
      .filter((path) => path.endsWith('/index.vue'))
      .map((path) => [`./views/${path}`, async () => resolve(root, 'views', path)])
  )
  const shared = await load(resolve(root, 'index.ts'), { './views/**/index.vue': views })
  const charging = await load(resolve(root, '../charging-management-ui/index.ts'))
  const sharedMenu = await load(resolve(root, 'baseMenu.ts'))
  const chargingMenu = await load(resolve(root, '../charging-management-ui/baseMenu.ts'))
  const modules = await load(resolve(host, 'jetlinks-web-core/src/utils/modules.ts'), {
    '../../../modules/*/index.ts': {
      '../../../modules/property-base-ui/index.ts': shared,
      '../../../modules/charging-management-ui/index.ts': charging
    },
    '../../../modules/*/baseMenu.ts': {
      '../../../modules/property-base-ui/baseMenu.ts': sharedMenu,
      '../../../modules/charging-management-ui/baseMenu.ts': chargingMenu
    }
  })
  const menus = modules.getModulesMenu()
  // 收费可继续增加自己的业务菜单；公共基础目录只能由公共模块提供一份。
  const publicMenus = menus.filter(menu => menu.code === 'charging/basic')
  assert.equal(publicMenus.length, 1)
  const publicMenu = publicMenus[0]
  assert.equal(publicMenu.name, '物业基础管理')
  assert.equal(publicMenu.id, 'charging-basic')
  assert.equal(publicMenu.options?.appName, undefined)
  assert.equal(publicMenu.children.length, 5)
  assert.equal(chargingMenu.default().some(menu => menu.code === 'charging/basic'), false)
  const routes = shared.default.getAsyncRoutesMap()
  for (const menu of publicMenu.children) {
    assert.equal(typeof routes[menu.code], 'function', `缺少既有菜单 ${menu.code} 的页面`)
    const filename = await routes[menu.code]()
    assert.ok(readFileSync(filename, 'utf8').includes('<template>'))
    assert.equal(menu.runtime, true)
  }
  assert.deepEqual(charging.default.getAsyncRoutesMap(), {})
  const space = publicMenu.children.find((menu) => menu.code === 'charging/Space')
  assert.equal(space.buttons.find((button) => button.id === 'save').permissions[0].permission, 'property-house')
  modules.registerModule()
  assert.equal(resources.size, 2)
  const chargingApis = resources.get('charging-management-ui').apis
  for (const name of ['getOrganizationTree', 'getProjectOptions', 'getSpaceTree', 'queryPropertyUsers']) {
    assert.equal(chargingApis[name], undefined, `收费不应重复注册公共资源 ${name}`)
  }
  const sharedResources = resources.get('property-base-ui')
  assert.deepEqual(Object.keys(sharedResources.components).sort(), ['ProjectSelect', 'SpaceInformation', 'UserIdentityTags'])
  const response = await sharedResources.apis.getOrganizationTree()
  assert.equal(response.result[0].id, 'organization')
  assert.equal(requests[0][0], '/property/organization/_tree')
})
