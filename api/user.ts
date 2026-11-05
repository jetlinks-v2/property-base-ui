import { request as hostRequest, type Request } from '@jetlinks-web/core'

const request: Pick<Request, 'get' | 'put' | 'post'> = hostRequest
export type UserIdentityValue = 'owner' | 'employee'
export interface UserIdentity {
  value: UserIdentityValue
  text: string
}
export interface PropertyUser {
  id: string
  username: string
  name?: string
  telephone?: string
  email?: string
  accountType: string
  status: number
  createTime?: number
  sourceModifyTime?: number
  sourceUpdateTime?: number
  orgList: { orgId: string; name?: string; fullName?: string }[]
  identities: UserIdentity[]
  version: number
  modifierName?: string
  modifyTime?: number
}
export interface UserSyncStatus {
  taskId?: string
  status: 'idle' | 'running' | 'succeeded' | 'failed'
  running: boolean
  lastSuccessTime?: number
  lastFailureTime?: number
  lastError?: string
  added?: number
  updated?: number
  deleted?: number
}
export interface UserCounts {
  all: number
  owner: number
  employee: number
  unmarked: number
}
export type UserTerm =
  | { column: string; termType: string; value?: unknown; type?: 'and' | 'or' }
  | { terms: UserTerm[]; type?: 'and' | 'or' }
export interface UserQuery {
  terms: UserTerm[]
  pageIndex?: number
  pageSize?: number
  sorts?: { name: string; order: string }[]
}
export interface UserPage {
  data: PropertyUser[]
  total: number
  pageIndex: number
  pageSize: number
}
const base = '/property/user'
export const queryPropertyUsers = (query: UserQuery, signal?: AbortSignal) =>
  request.post<UserPage>(`${base}/_query`, query, { signal })
export const countPropertyUsers = (query: UserQuery) => request.post<UserCounts>(`${base}/_counts`, query)
export const getPropertyUser = (id: string) => request.get<PropertyUser>(`${base}/${encodeURIComponent(id)}`)
export const getUserIdentities = () => request.get<UserIdentity[]>(`${base}/_identities`)
/** 完整替换身份集合；[] 清空。不得省略 identities，也不自动重试版本冲突。 */
export const setUserIdentities = (id: string, identities: UserIdentityValue[], version: number) =>
  request.put<PropertyUser>(`${base}/${encodeURIComponent(id)}/identities`, { identities, version })
export const synchronizeUsers = () => request.post<UserSyncStatus>(`${base}/_sync`)
export const getUserSyncStatus = () => request.get<UserSyncStatus>(`${base}/_sync/status`)
