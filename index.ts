import { getModuleRoutesMap } from '@jetlinks-web/utils'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import registerSetting from './register'
import { name } from './package.json'

// 保留既有 charging/* 页面编码，已初始化的菜单及按钮授权无需更换标识。
const routerModules = import.meta.glob('./views/**/index.vue')

export default {
  getAsyncRoutesMap: () => getModuleRoutesMap(routerModules),
  getExtraRoutesMap: () => ({}),
  getComponents: () => ({}),
  getCoreRouteOverrides: () => [],
  register: () => moduleRegistry.register(name, registerSetting)
}
