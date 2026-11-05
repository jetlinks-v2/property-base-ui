import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePermission } from '@jetlinks-web/hooks'
import { onlyMessage } from '@jetlinks-web/utils'
import {
  getOrganization,
  getOrganizationSyncStatus,
  getOrganizationTree,
  getOrganizationTypes,
  setOrganizationType,
  synchronizeOrganizations,
  type OrganizationSyncStatus,
  type OrganizationType,
  type OrganizationTypeValue,
  type PropertyOrganization
} from '../api/organization'
import { filterOrganizationTree, flattenOrganizations, replaceOrganization } from '../utils/organizationTree'

export const organizationPermission = 'charging/OrganizationType'

/** 单节点即选即存；所有入口共用基础接口，页面卸载或切换选择后丢弃旧详情响应。 */
export function useOrganizationType() {
  const { t } = useI18n()
  const key = 'OrganizationType.'
  const { hasPerm: canSave } = usePermission(`${organizationPermission}:save`)
  const tree = ref<PropertyOrganization[]>([])
  const types = ref<OrganizationType[]>([])
  const status = ref<OrganizationSyncStatus>()
  const keyword = ref('')
  const unmarkedOnly = ref(false)
  const selectedId = ref('')
  const expandedKeys = ref<string[]>([])
  const detail = ref<PropertyOrganization>()
  const loading = ref(false)
  const failed = ref(false)
  const statusFailed = ref(false)
  const detailLoading = ref(false)
  const detailFailed = ref(false)
  const saving = ref(false)
  const syncing = ref(false)
  let generation = 0
  let disposed = false
  let statusTimer: ReturnType<typeof setTimeout> | undefined
  const organizations = computed(() => flattenOrganizations(tree.value))
  const visibleTree = computed(() => filterOrganizationTree(tree.value, keyword.value, unmarkedOnly.value))
  const unmarkedCount = computed(() => organizations.value.filter((node) => !node.organizationType).length)
  const parentName = computed(() => organizations.value.find((node) => node.id === detail.value?.parentId)?.name)
  const syncRunning = computed(() => syncing.value || !!status.value?.running)
  const editable = computed(
    () =>
      canSave.value &&
      !saving.value &&
      !loading.value &&
      !failed.value &&
      !syncRunning.value &&
      !detailLoading.value &&
      !detailFailed.value &&
      !!detail.value
  )
  const dateText = (time?: number) => (time ? new Date(time).toLocaleString() : t(key + 'never'))

  // 项目章和类型共享同一组织版本，子组件保存后立即更新，避免后续编辑使用旧版本。
  function acceptDetail(value: PropertyOrganization) {
    if (disposed || selectedId.value !== value.id) return
    detail.value = value
    tree.value = replaceOrganization(tree.value, value)
  }

  async function select(id: string) {
    if (saving.value) return
    selectedId.value = id
    detail.value = undefined
    detailFailed.value = false
    const token = ++generation
    detailLoading.value = false
    if (!id) return
    detailLoading.value = true
    try {
      const response = await getOrganization(id)
      if (disposed || token !== generation) return
      if (!response.success) throw new Error('Organization detail rejected')
      detail.value = response.result
      tree.value = replaceOrganization(tree.value, response.result)
    } catch {
      if (!disposed && token === generation) detailFailed.value = true
    } finally {
      if (!disposed && token === generation) detailLoading.value = false
    }
  }

  async function refreshStatus() {
    if (statusTimer) clearTimeout(statusTimer)
    try {
      const response = await getOrganizationSyncStatus()
      if (!response.success) throw new Error('Organization sync status rejected')
      if (!disposed) {
        const wasRunning = status.value?.running
        status.value = response.result
        statusFailed.value = false
        // 其他实例正在同步时仅轮询状态，结束后才刷新组织，避免一直锁住标注。
        if (response.result.running)
          statusTimer = setTimeout(() => {
            void refreshStatus()
          }, 2000)
        else if (wasRunning && !syncing.value) await reload()
      }
    } catch {
      if (!disposed) statusFailed.value = true
    }
  }

  async function reload() {
    if (loading.value || saving.value) return
    loading.value = true
    failed.value = false
    try {
      const [response, options] = await Promise.all([getOrganizationTree(), getOrganizationTypes()])
      if (disposed) return
      if (!response.success || !options.success) throw new Error('Organization tree rejected')
      tree.value = response.result
      types.value = options.result
      const ids = new Set(organizations.value.map((node) => node.id))
      expandedKeys.value = expandedKeys.value.filter((id) => ids.has(id))
      if (!selectedId.value) expandedKeys.value = tree.value.map((node) => node.id)
      if (selectedId.value && !ids.has(selectedId.value)) {
        onlyMessage(t(key + 'selectionGone'), 'warning')
        await select('')
      } else if (selectedId.value) await select(selectedId.value)
    } catch {
      if (!disposed) failed.value = true
    } finally {
      if (!disposed) loading.value = false
    }
  }

  async function save(type: OrganizationTypeValue | null) {
    const current = detail.value
    if (!editable.value || !current || (current.organizationType?.value || null) === type) return
    saving.value = true
    try {
      const response = await setOrganizationType(current.id, type, current.version)
      if (disposed) return
      if (!response.success) throw new Error('Organization type rejected')
      detail.value = response.result
      tree.value = replaceOrganization(tree.value, response.result)
      onlyMessage(t(key + (type ? 'saved' : 'cleared'), { name: current.name }), 'success')
    } catch {
      // 保存失败不改标签；重新获取详情供用户确认后再次选择，避免用旧版本覆盖。
      if (!disposed) {
        onlyMessage(t(key + 'saveFailed', { name: current.name }), 'error')
        saving.value = false
        await select(current.id)
      }
    } finally {
      if (!disposed) saving.value = false
    }
  }

  async function synchronize() {
    if (syncRunning.value || saving.value || loading.value) return
    syncing.value = true
    try {
      const response = await synchronizeOrganizations()
      if (disposed) return
      if (!response.success) throw new Error('Organization sync rejected')
      onlyMessage(t(key + 'syncSuccess', { ...response.result }), 'success')
      await reload()
    } catch {
      if (!disposed) onlyMessage(t(key + 'syncFailed'), 'error')
    } finally {
      if (!disposed) {
        syncing.value = false
        await refreshStatus()
      }
    }
  }

  watch([keyword, unmarkedOnly], () => {
    if (keyword.value.trim() || unmarkedOnly.value)
      expandedKeys.value = flattenOrganizations(visibleTree.value).map((node) => node.id)
  })
  onMounted(() => {
    void reload()
    void refreshStatus()
  })
  onScopeDispose(() => {
    disposed = true
    generation++
    if (statusTimer) clearTimeout(statusTimer)
  })
  return {
    tree,
    types,
    status,
    keyword,
    unmarkedOnly,
    selectedId,
    expandedKeys,
    detail,
    loading,
    failed,
    statusFailed,
    detailLoading,
    detailFailed,
    saving,
    syncing,
    organizations,
    visibleTree,
    unmarkedCount,
    parentName,
    syncRunning,
    editable,
    dateText,
    acceptDetail,
    select,
    refreshStatus,
    reload,
    save,
    synchronize
  }
}
