import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { checked, getSpaceTree, spaceSyncStatus, syncSpaces, type Space, type SpaceSyncStatus } from '../../api/archive'
import { getOrganizationTree, type PropertyOrganization } from '../../api/organization'
import { flattenOrganizations } from '../../utils/organizationTree'
import { toProjectTree } from '../../utils/projectTree'

export const flattenSpaces = (nodes: Space[]): Space[] =>
  nodes.flatMap((node) => [node, ...flattenSpaces(node.children || [])])
export const filterSpaces = (nodes: Space[], keyword: string): Space[] =>
  nodes.flatMap((node) => {
    const children = filterSpaces(node.children || [], keyword)
    return node.name.toLowerCase().includes(keyword.trim().toLowerCase()) || children.length
      ? [{ ...node, children }]
      : []
  })
/** 来源 leaf 保留完整来源树的事实；资料完善和客户关联不依赖节点层级。 */
export function useArchiveScope() {
  const organizations = ref<PropertyOrganization[]>([])
  const projects = computed(() =>
    flattenOrganizations(organizations.value).filter((node) => node.organizationType?.value === 'project')
  )
  const projectTree = computed(() => toProjectTree(organizations.value))
  const projectId = ref('')
  const tree = ref<Space[]>([])
  const selectedId = ref<string>()
  const keyword = ref('')
  const loading = ref(false)
  const failed = ref(false)
  const syncing = ref(false)
  const status = ref<SpaceSyncStatus>()
  const statusFailed = ref(false)
  let generation = 0
  let projectGeneration = 0
  let disposed = false
  const selected = computed(() => flattenSpaces(tree.value).find((node) => node.id === selectedId.value))
  const scope = computed(() => ({ projectId: projectId.value, spaceId: selectedId.value }))
  const visibleTree = computed(() => filterSpaces(tree.value, keyword.value))
  async function loadProjects() {
    const token = ++projectGeneration
    try {
      const result = checked(await getOrganizationTree())
      if (disposed || token !== projectGeneration) return
      organizations.value = result
      if (!projects.value.some((item) => item.id === projectId.value)) projectId.value = projects.value[0]?.id || ''
      failed.value = false
    } catch {
      if (!disposed && token === projectGeneration) failed.value = true
    }
  }
  function selectProject(id: string) {
    if (projects.value.some((item) => item.id === id)) projectId.value = id
  }
  async function loadTree() {
    const token = ++generation
    tree.value = []
    selectedId.value = undefined
    if (!projectId.value) return
    loading.value = true
    failed.value = false
    try {
      const result = await getSpaceTree(projectId.value)
      if (!disposed && token === generation) tree.value = result
    } catch {
      if (!disposed && token === generation) failed.value = true
    } finally {
      if (!disposed && token === generation) loading.value = false
    }
  }
  async function refreshStatus() {
    try {
      const result = await spaceSyncStatus()
      if (!disposed) {
        status.value = result
        statusFailed.value = false
      }
    } catch {
      if (!disposed) statusFailed.value = true
    }
  }
  async function synchronize() {
    if (syncing.value || status.value?.running) return
    syncing.value = true
    try {
      await syncSpaces()
      await loadTree()
    } finally {
      syncing.value = false
      await refreshStatus()
    }
  }
  watch(projectId, () => {
    void loadTree()
  })
  onMounted(() => {
    void loadProjects()
    void refreshStatus()
  })
  onScopeDispose(() => {
    disposed = true
    generation++
    projectGeneration++
  })
  return {
    projects,
    projectTree,
    selectProject,
    projectId,
    tree,
    selectedId,
    keyword,
    visibleTree,
    selected,
    scope,
    loading,
    failed,
    syncing,
    status,
    statusFailed,
    loadProjects,
    loadTree,
    refreshStatus,
    synchronize
  }
}
