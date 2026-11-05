import type { PropertyOrganization } from '../api/organization'

export interface OrganizationTreeNode extends PropertyOrganization {
  key: string
  title: string
  contextOnly: boolean
  children: OrganizationTreeNode[]
}

/** 筛选保留祖先以供定位；contextOnly 明确祖先自身并未命中。 */
export function filterOrganizationTree(
  tree: PropertyOrganization[],
  keyword: string,
  unmarkedOnly: boolean
): OrganizationTreeNode[] {
  const query = keyword.trim().toLocaleLowerCase()
  return tree.flatMap((node) => {
    const children = filterOrganizationTree(node.children || [], query, unmarkedOnly)
    const matches = node.name.toLocaleLowerCase().includes(query) && (!unmarkedOnly || !node.organizationType)
    return matches || children.length
      ? [{ ...node, key: node.id, title: node.name, contextOnly: !matches, children }]
      : []
  })
}

export function flattenOrganizations(tree: PropertyOrganization[]): PropertyOrganization[] {
  return tree.flatMap((node) => [node, ...flattenOrganizations(node.children || [])])
}

export function replaceOrganization(tree: PropertyOrganization[], next: PropertyOrganization): PropertyOrganization[] {
  return tree.map((node) => ({
    ...(node.id === next.id ? next : node),
    children: replaceOrganization(node.children || [], next)
  }))
}
