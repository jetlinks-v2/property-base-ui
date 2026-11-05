import type { UserIdentityValue, UserTerm } from '../api/user'
import type { PropertyOrganization } from '../api/organization'

export type UserTab = 'all' | UserIdentityValue | 'unmarked'

/** 筛选条件先分组，再追加身份，避免用户输入的 OR 绕过当前身份页签。 */
export function userTerms(filters: UserTerm[], tab: UserTab): UserTerm[] {
  const terms: UserTerm[] = filters.length ? [{ terms: filters }] : []
  if (tab === 'owner' || tab === 'employee') terms.push({ column: tab, termType: 'eq', value: true })
  if (tab === 'unmarked')
    terms.push({ column: 'owner', termType: 'eq', value: false }, { column: 'employee', termType: 'eq', value: false })
  return terms
}

export function organizationIds(tree: PropertyOrganization[], id: string, descendants: boolean): string[] {
  for (const node of tree) {
    if (node.id === id) return [id, ...(descendants ? (node.children || []).flatMap(collectIds) : [])]
    const found = organizationIds(node.children || [], id, descendants)
    if (found.length) return found
  }
  return []
}
const collectIds = (node: PropertyOrganization): string[] => [node.id, ...(node.children || []).flatMap(collectIds)]

export function sameIdentities(current: { value: string }[], next: UserIdentityValue[]): boolean {
  return current.length === next.length && current.every((item) => next.includes(item.value as UserIdentityValue))
}

export const accountState = (status: number) => (status === 1 ? 'enabled' : status === 0 ? 'disabled' : 'unknown')
