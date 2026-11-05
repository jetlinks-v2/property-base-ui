import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { getOrganizationTree, type PropertyOrganization } from '../api/organization'
import {
  countPropertyUsers,
  getUserIdentities,
  queryPropertyUsers,
  type UserCounts,
  type UserIdentity,
  type UserQuery,
  type UserTerm
} from '../api/user'
import { organizationIds, userTerms, type UserTab } from '../utils/userQuery'

export function useUserList() {
  const table = ref<{ reload: () => void }>()
  const tab = ref<UserTab>('all')
  const filters = ref<UserTerm[]>([])
  const searchTerms = ref<UserTerm[]>([])
  const organizationId = ref<string>()
  const includeChildren = ref(true)
  const organizations = ref<PropertyOrganization[]>([])
  const identities = ref<UserIdentity[]>([])
  const optionsFailed = ref(false)
  const failed = ref(false)
  const countsFailed = ref(false)
  const counts = ref<UserCounts>()
  let disposed = false
  let countGeneration = 0
  let requestGeneration = 0
  let optionsGeneration = 0
  const baseTerms = computed(() => {
    const terms = filters.value.length ? [{ terms: filters.value }] : []
    if (!organizationId.value) return terms
    const ids = organizationIds(organizations.value, organizationId.value, includeChildren.value)
    return [
      ...terms,
      { column: 'id', termType: 'property-user-org', value: { orgId$in: ids.length ? ids : ['_no-organization_'] } }
    ]
  })
  const params = computed<UserQuery>(() => ({
    terms: userTerms(baseTerms.value, tab.value),
    sorts: [
      { name: 'createTime', order: 'desc' },
      { name: 'id', order: 'asc' }
    ]
  }))

  async function request(query: UserQuery, context?: { signal: AbortSignal }) {
    const token = ++requestGeneration
    failed.value = false
    try {
      const response = await queryPropertyUsers(query, context?.signal)
      if (!response.success) throw new Error('User query rejected')
      return response
    } catch (error) {
      if (!disposed && token === requestGeneration && !context?.signal.aborted) failed.value = true
      throw error
    }
  }

  async function refreshCounts() {
    const token = ++countGeneration
    try {
      const response = await countPropertyUsers({ terms: baseTerms.value })
      if (!response.success) throw new Error('User counts rejected')
      if (!disposed && token === countGeneration) {
        counts.value = response.result
        countsFailed.value = false
      }
    } catch {
      if (!disposed && token === countGeneration) {
        counts.value = undefined
        countsFailed.value = true
      }
    }
  }

  async function loadOptions() {
    const token = ++optionsGeneration
    const result = await Promise.allSettled([getOrganizationTree(), getUserIdentities()])
    if (disposed || token !== optionsGeneration) return
    optionsFailed.value = result.some((item) => item.status === 'rejected' || !item.value.success)
    if (result[0].status === 'fulfilled' && result[0].value.success) organizations.value = result[0].value.result
    if (result[1].status === 'fulfilled' && result[1].value.success) identities.value = result[1].value.result
  }

  function reload() {
    table.value?.reload()
    void refreshCounts()
  }
  function resetFilters() {
    searchTerms.value = []
    filters.value = []
    organizationId.value = undefined
    includeChildren.value = true
    tab.value = 'all'
  }
  watch(
    baseTerms,
    () => {
      counts.value = undefined
      void refreshCounts()
    },
    { immediate: true }
  )
  onMounted(() => {
    void loadOptions()
  })
  onScopeDispose(() => {
    disposed = true
    countGeneration++
    requestGeneration++
    optionsGeneration++
  })
  return {
    table,
    tab,
    filters,
    searchTerms,
    organizationId,
    includeChildren,
    organizations,
    identities,
    optionsFailed,
    failed,
    countsFailed,
    counts,
    params,
    request,
    refreshCounts,
    loadOptions,
    reload,
    resetFilters
  }
}
