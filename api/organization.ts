import { request as hostRequest, type Request } from '@jetlinks-web/core'

const request: Pick<Request, 'get' | 'put' | 'post' | 'remove'> = hostRequest

export type OrganizationTypeValue = 'project' | 'external'
export interface OrganizationType {
  value: OrganizationTypeValue
  text: string
}
export interface PropertyOrganization {
  id: string
  name: string
  parentId?: string
  code?: string
  sortIndex?: number
  organizationType?: OrganizationType | null
  projectSealFileId?: string | null
  version: number
  sourceUpdateTime?: number
  modifierName?: string
  modifyTime?: number
  children?: PropertyOrganization[]
}
export interface OrganizationSyncStatus {
  running: boolean
  lastSuccessTime?: number
  lastFailureTime?: number
  lastError?: string
}
export interface OrganizationSyncResult {
  added: number
  updated: number
  deleted: number
  completedTime: number
}

const base = '/property/organization'
/** 所有业务模块共用基础模块接口；鉴权和应用上下文由宿主请求实例提供。 */
export const getOrganizationTree = () => request.get<PropertyOrganization[]>(`${base}/_tree`)
export const getOrganizationTypes = () => request.get<OrganizationType[]>(`${base}/_types`)
export const getOrganization = (id: string) => request.get<PropertyOrganization>(`${base}/${encodeURIComponent(id)}`)
/** null 显式清除标注；version 来自最新详情，冲突由后端拒绝，禁止自动覆盖重试。 */
export const setOrganizationType = (id: string, organizationType: OrganizationTypeValue | null, version: number) =>
  request.put<PropertyOrganization>(`${base}/${encodeURIComponent(id)}/type`, { organizationType, version })
export const synchronizeOrganizations = () => request.post<OrganizationSyncResult>(`${base}/_sync`)
export const getOrganizationSyncStatus = () => request.get<OrganizationSyncStatus>(`${base}/_sync/status`)

/** 仅清除项目引用，不删除历史文件；与组织类型共享版本，冲突不得自动重试。 */
export const removeProjectSeal = (id: string, version: number) =>
  request.remove<PropertyOrganization>(
    `${base}/${encodeURIComponent(id)}/project-seal?version=${version}`,
    {},
    { hiddenError: true }
  )

/** 基础服务校验项目和真实图片，上传公共文件并保存引用；客户端不分步提交文件 ID。 */
export const uploadProjectSeal = (id: string, version: number, file: File) => {
  const body = new FormData()
  body.append('file', file)
  return request.put<PropertyOrganization>(
    `${base}/${encodeURIComponent(id)}/project-seal?version=${version}`,
    body,
    { hiddenError: true }
  )
}
