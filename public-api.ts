/** 业务模块只引用此公开入口或 moduleRegistry，不引用 views/hooks 内部实现。 */
export * from './api'
export { toProjectTree } from './utils/projectTree'
export type { ProjectTreeNode } from './utils/projectTree'
export { default as ProjectSelect } from './components/ProjectSelect.vue'
export { default as SpaceInformation } from './views/charging/components/SpaceInformation.vue'
export { default as UserIdentityTags } from './views/charging/User/UserIdentityTags.vue'

export type PropertyBaseApis = typeof import('./register').default.apis
export type PropertyBaseComponents = typeof import('./register').default.components
