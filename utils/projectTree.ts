import type { PropertyOrganization } from '../api/organization'

export interface ProjectTreeNode {
  value: string
  title: string
  disabled: boolean
  children: ProjectTreeNode[]
}

/** 保留完整组织层级，仅项目可选；父组织禁用不影响展开或选择下级项目。 */
export const toProjectTree = (nodes: PropertyOrganization[]): ProjectTreeNode[] =>
  nodes.map((node) => ({
    value: node.id,
    title: node.name,
    disabled: node.organizationType?.value !== 'project',
    children: toProjectTree(node.children || [])
  }))
