import { onMounted, onScopeDispose, ref } from 'vue'
import { checked, getHouse, queryCustomers, queryHistory, type Query, type Scope, type Space } from '../../api/archive'
export function useCustomerList(scope: Scope, space?: Space) {
  const table = ref<{ reload: () => void }>()
  const history = ref(false)
  const creating = ref(false)
  const failed = ref(false)
  const houseLoading = ref(false)
  const houseFailed = ref(false)
  const houseCompleted = ref(false)
  let disposed = false
  async function loadHouse() {
    // 任意层级均可关联客户，资格由已完善资料决定；来源 leaf 不再作为业务门禁。
    if (!space) return
    houseLoading.value = true
    houseFailed.value = false
    try {
      const house = await getHouse(scope, space.id)
      if (!disposed) houseCompleted.value = house.completed
    } catch {
      if (!disposed) houseFailed.value = true
    } finally {
      if (!disposed) houseLoading.value = false
    }
  }
  async function request(query: Query, context?: { signal: AbortSignal }) {
    failed.value = false
    try {
      const response = history.value
        ? await queryHistory(scope, query, context?.signal)
        : await queryCustomers(scope, query, context?.signal)
      if (!response.success) throw new Error('Customer query rejected')
      return response
    } catch (cause) {
      if (!disposed && !context?.signal.aborted) failed.value = true
      throw cause
    }
  }
  const reload = () => table.value?.reload()
  const saved = () => {
    creating.value = false
    reload()
  }
  onMounted(() => {
    void loadHouse()
  })
  onScopeDispose(() => {
    disposed = true
  })
  return {
    table,
    history,
    creating,
    failed,
    houseLoading,
    houseFailed,
    houseCompleted,
    loadHouse,
    request,
    reload,
    saved
  }
}
