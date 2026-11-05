import { request as hostRequest, type Request } from '@jetlinks-web/core'
import type { UserQuery } from './user'
import { historyQuery } from '../utils/historyQuery'
import { excelResponse } from '../utils/archiveFiles'
const request: Pick<Request, 'get' | 'post' | 'put' | 'remove'> = hostRequest

export type Query = UserQuery
export type CustomerType = 'person' | 'company'
export interface Page<T> {
  data: T[]
  total: number
  pageIndex: number
  pageSize: number
}
export interface Scope {
  projectId: string
  spaceId?: string
}
export interface SpaceSegment {
  id: string
  name: string
  typeId?: string
  typeName?: string
}
export interface Space {
  id: string
  name: string
  parentId?: string | null
  rootId?: string
  fullName?: string
  spaceTypeId?: string
  spaceTypeName?: string
  spaceSegments?: SpaceSegment[]
  spaceLocation?: string
  organizationId?: string | null
  version: number
  leaf: boolean
  children?: Space[]
}
export interface DictionaryType {
  id: string
  code: string
  name: string
  enabled: boolean
  version: number
  sortIndex?: number
  description?: string
}
export interface DictionaryItem {
  id: string
  typeCode: string
  value: string
  text: string
  enabled: boolean
  version: number
  sortIndex?: number
  description?: string
}
export interface House {
  id: string
  spaceId: string
  name: string
  fullName?: string
  spaceTypeId?: string
  spaceTypeName?: string
  spaceSegments?: SpaceSegment[]
  spaceLocation?: string
  projectId: string
  completed: boolean
  version: number
  houseType?: string
  houseState?: string
  billingArea?: number
  buildingArea?: number
  insideArea?: number
  deliveryDate?: number
  remark?: string
}
export type HouseInput = Pick<
  House,
  'houseType' | 'houseState' | 'billingArea' | 'buildingArea' | 'insideArea' | 'deliveryDate' | 'remark'
>
export interface CustomerProfile {
  name: string
  telephone: string
  email?: string
  address?: string
  certificateType?: string
  certificateNumber?: string
  creditCode?: string
  legalRepresentative?: string
  registeredAddress?: string
}
export interface RelationInput {
  spaceId: string
  nature?: string
}
export interface CustomerCreate extends CustomerProfile, RelationInput {
  userId: string
  customerType: 'person' | 'company'
}
export interface Customer extends CustomerProfile {
  id: string
  recordId?: string
  projectId: string
  userId: string
  customerType: 'person' | 'company'
  version: number
  deleted: boolean
  profileComplete?: boolean
  pendingBinding?: boolean
  createTime?: number
  modifyTime?: number
  relationships: Relationship[]
}
export interface Relationship {
  id: string
  projectId: string
  customerId: string
  spaceId: string
  spaceName: string
  fullName?: string
  spaceTypeId?: string
  spaceTypeName?: string
  spaceSegments?: SpaceSegment[]
  spaceLocation?: string
  nature?: string
  startTime: number
  endTime?: number
  endReason?: string
  version: number
  customer?: Customer
}
export interface SpaceSyncStatus {
  running: boolean
  lastSuccessTime?: number
  lastFailureTime?: number
  lastError?: string
}
const base = '/property'
const id = encodeURIComponent
/** 项目范围始终显式传递，不能落回宿主的隐含项目上下文。 */
export const scopeQuery = (scope: Scope) =>
  new URLSearchParams({ projectId: scope.projectId, ...(scope.spaceId ? { spaceId: scope.spaceId } : {}) }).toString()
export const checked = <T>(response: { success: boolean; result: T; message?: string }): T => {
  if (!response.success) throw new Error(response.message || 'Request rejected')
  return response.result
}
export const getSpaceProjects = () =>
  request.get<{ id: string; name: string }[]>(`${base}/space/_projects`).then(checked)
export const getSpaceRoots = () => request.get<Space[]>(`${base}/space/_roots`).then(checked)
export const getSpaceRootTree = (rootId: string) =>
  request.get<Space[]>(`${base}/space/${id(rootId)}/_tree`).then(checked)
export const getSpaceTree = (projectId: string) =>
  request.get<Space[]>(`${base}/space/_tree?${scopeQuery({ projectId })}`).then(checked)
export const bindSpaceRoot = (rootId: string, organizationId: string | null, version: number) =>
  request.put<Space>(`${base}/space/${id(rootId)}/organization`, { organizationId, version }).then(checked)
export const syncSpaces = () =>
  request
    .post<{ added: number; updated: number; deleted: number; completedAt: number }>(`${base}/space/_sync`)
    .then(checked)
export const spaceSyncStatus = () => request.get<SpaceSyncStatus>(`${base}/space/_sync/status`).then(checked)
export const getDictionaryTypes = () => request.get<DictionaryType[]>(`${base}/dictionary/_types`).then(checked)
export const saveDictionaryType = (value: {
  code: string
  name: string
  enabled: boolean
  id?: string
  version?: number
  sortIndex?: number
  description?: string
}) =>
  value.id
    ? request
        .put<DictionaryType>(`${base}/dictionary/_types/${id(value.id)}`, {
          name: value.name,
          enabled: value.enabled,
          version: value.version,
          sortIndex: value.sortIndex,
          description: value.description
        })
        .then(checked)
    : request
        .post<DictionaryType>(`${base}/dictionary/_types`, {
          code: value.code,
          name: value.name,
          enabled: value.enabled,
          sortIndex: value.sortIndex,
          description: value.description
        })
        .then(checked)
export const deleteDictionaryType = (value: DictionaryType) =>
  request.remove(`${base}/dictionary/_types/${id(value.id)}?version=${value.version}`).then(checked)
export const getDictionaryItems = (code: string) =>
  request.get<DictionaryItem[]>(`${base}/dictionary/${id(code)}/_items`).then(checked)
export const saveDictionaryItem = (
  code: string,
  value: {
    value: string
    text: string
    enabled: boolean
    id?: string
    version?: number
    sortIndex?: number
    description?: string
  }
) =>
  value.id
    ? request
        .put<DictionaryItem>(`${base}/dictionary/items/${id(value.id)}`, {
          text: value.text,
          enabled: value.enabled,
          version: value.version,
          sortIndex: value.sortIndex,
          description: value.description
        })
        .then(checked)
    : request
        .post<DictionaryItem>(`${base}/dictionary/${id(code)}/_items`, {
          value: value.value,
          text: value.text,
          enabled: value.enabled,
          sortIndex: value.sortIndex,
          description: value.description
        })
        .then(checked)
export const deleteDictionaryItem = (value: DictionaryItem) =>
  request.remove(`${base}/dictionary/items/${id(value.id)}?version=${value.version}`).then(checked)
export const queryHouses = (scope: Scope, query: Query, signal?: AbortSignal) =>
  request.post<Page<House>>(`${base}/house/_query?${scopeQuery(scope)}`, query, { signal })
export const getHouse = (scope: Scope, spaceId: string) =>
  request.get<House>(`${base}/house/${id(spaceId)}?${scopeQuery(scope)}`).then(checked)
export const saveHouse = (scope: Scope, spaceId: string, value: HouseInput & { version: number }) =>
  request.put<House>(`${base}/house/${id(spaceId)}?${scopeQuery(scope)}`, value).then(checked)
export const deleteHouse = (scope: Scope, house: House) =>
  request.remove(`${base}/house/${id(house.spaceId)}?${scopeQuery(scope)}&version=${house.version}`).then(checked)
/** 文件范围由外层项目确定；上传原文件，由后端完成全量校验和事务写入。 */
const importFile = (kind: 'house' | 'customer', scope: Scope, file: File, customerType?: CustomerType) => {
  const form = new FormData()
  form.append('file', file)
  return request
    .post<{ count: number }>(`${base}/${kind}/_import?${importQuery(scope, kind, customerType)}`, form, {
      hiddenError: true
    })
    .then(checked)
}
const importQuery = (scope: Scope, kind: 'house' | 'customer', customerType?: CustomerType) => {
  const query = scopeQuery({ projectId: scope.projectId })
  if (kind === 'house') return query
  if (customerType !== 'person' && customerType !== 'company') throw new Error('Customer type is required')
  return `${query}&customerType=${customerType}`
}
export const getArchiveTemplate = (scope: Scope, kind: 'house' | 'customer', customerType?: CustomerType) =>
  request
    .get<Blob>(
      `${base}/${kind}/template.xlsx?${importQuery(scope, kind, customerType)}`,
      {},
      { responseType: 'blob', hiddenError: true }
    )
    .then(excelResponse)
export const importHouses = (scope: Scope, file: File) => importFile('house', scope, file)
export const exportHouses = (scope: Scope, query: Query) =>
  request
    .post<Blob>(`${base}/house/_export?${scopeQuery(scope)}`, query, { responseType: 'blob', hiddenError: true })
    .then(excelResponse)
export const queryCustomers = (scope: Scope, query: Query, signal?: AbortSignal) =>
  request.post<Page<Customer>>(`${base}/customer/_query?${scopeQuery(scope)}`, query, { signal })
export const queryCustomerProfiles = (scope: Scope, query: Query) =>
  request.post<Page<Customer>>(`${base}/customer/_profiles?${scopeQuery({ projectId: scope.projectId })}`, query)
export const getCustomer = (scope: Scope, customerId: string) =>
  request.get<Customer>(`${base}/customer/${id(customerId)}?${scopeQuery(scope)}`).then(checked)
export const createCustomer = (scope: Scope, value: CustomerCreate) =>
  request.post<Customer>(`${base}/customer?${scopeQuery(scope)}`, value).then(checked)
export const saveCustomer = (
  scope: Scope,
  customerId: string,
  value: CustomerProfile & { version: number; relationshipId?: string; relationshipVersion?: number; nature?: string }
) => request.put<Customer>(`${base}/customer/${id(customerId)}?${scopeQuery(scope)}`, value).then(checked)
export const addRelationship = (scope: Scope, customerId: string, value: RelationInput) =>
  request
    .post<Relationship>(`${base}/customer/${id(customerId)}/relationships?${scopeQuery(scope)}`, value)
    .then(checked)
export const deleteRelationship = (scope: Scope, value: Relationship) =>
  request
    .remove(`${base}/customer/relationships/${id(value.id)}?${scopeQuery(scope)}&version=${value.version}`)
    .then(checked)
export const queryHistory = (scope: Scope, query: Query, signal?: AbortSignal) =>
  request.post<Page<Relationship>>(`${base}/customer/_history?${scopeQuery(scope)}`, historyQuery(query), { signal })
export const importCustomers = (scope: Scope, file: File, customerType: CustomerType) =>
  importFile('customer', scope, file, customerType)
export const exportCustomers = (scope: Scope, query: Query, history: boolean) =>
  request
    .post<Blob>(
      `${base}/customer/_export?${scopeQuery(scope)}&history=${history}`,
      history ? historyQuery(query) : query,
      { responseType: 'blob', hiddenError: true }
    )
    .then(excelResponse)
