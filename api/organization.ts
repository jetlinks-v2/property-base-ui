import { request as hostRequest, type Request } from '@jetlinks-web/core'

const request: Pick<Request, 'get' | 'put' | 'post'> = hostRequest

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

/** fileId=null 仅清除引用；版本与组织类型标注共享，冲突时不得自动重试。 */
export const setProjectSeal = (id: string, fileId: string | null, version: number) =>
  request.put<PropertyOrganization>(
    `${base}/${encodeURIComponent(id)}/seal`,
    { fileId, version },
    { hiddenError: true }
  )

/** 复用平台文件上传，不保存图片地址或客户端声明的文件元数据。 */
export const uploadProjectSeal = (file: File) => {
  const body = new FormData()
  body.append('file', file)
  return request.post<{ id: string }>('/file/upload', body, { hiddenError: true })
}
