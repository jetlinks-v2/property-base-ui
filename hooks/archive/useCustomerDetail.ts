import { onScopeDispose, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import {
  deleteRelationship,
  getCustomer,
  saveCustomer,
  type Customer,
  type CustomerProfile,
  type Relationship,
  type Scope
} from '../../api/archive'
import { profilePayload } from '../../utils/customer'
import { requestErrorMessage } from '../../utils/requestError'

export function useCustomerDetail(scope: Scope, reload: () => void) {
  const { t } = useI18n()
  const open = ref(false),
    loading = ref(false),
    failed = ref(false),
    busy = ref(false),
    editing = ref(false)
  const customer = ref<Customer>(),
    history = ref<Relationship>(),
    record = ref<Relationship>()
  const selectedId = ref('')
  const profile = reactive<CustomerProfile>({ name: '', telephone: '' })
  const relation = reactive<{ nature?: string }>({})
  let generation = 0,
    disposed = false
  let selection: Parameters<typeof select> | undefined
  function close() {
    generation++
    open.value = false
    editing.value = false
    customer.value = undefined
    record.value = undefined
    history.value = undefined
    selection = undefined
  }
  async function select(id: string, selected?: Relationship, mode: 'view' | 'edit' = 'view', historical = false) {
    selection = [id, selected, mode, historical]
    const token = ++generation
    open.value = true
    selectedId.value = id
    loading.value = false
    failed.value = false
    editing.value = false
    customer.value = undefined
    record.value = selected
    history.value = historical ? selected : undefined
    if (historical && selected?.customer) {
      customer.value = selected.customer
      return
    }
    loading.value = true
    try {
      const result = await getCustomer(scope, id)
      if (disposed || token !== generation) return
      customer.value = result
      record.value =
        result.relationships.find((item) => item.id === selected?.id) ||
        (!selected ? result.relationships[0] : undefined)
      if (selected && !record.value) throw new Error(t('Archive.detailFailed'))
      if (mode === 'edit') {
        Object.assign(profile, profilePayload(result, result.customerType))
        relation.nature = record.value?.nature
        editing.value = true
      }
    } catch {
      if (!disposed && token === generation) failed.value = true
    } finally {
      if (!disposed && token === generation) loading.value = false
    }
  }
  // 一份资料可有多条空间记录；失败重试必须保留原记录和编辑模式。
  function retry() {
    if (selection && open.value) return select(...selection)
  }
  async function mutate(action: () => Promise<unknown>) {
    if (busy.value) return
    const token = generation
    busy.value = true
    try {
      await action()
      reload()
      if (!disposed && token === generation) {
        close()
        onlyMessage(t('Archive.customerSaved'), 'success')
      }
    } catch (cause) {
      if (!disposed) onlyMessage(requestErrorMessage(cause, t('Archive.saveFailed')), 'error')
    } finally {
      if (!disposed) busy.value = false
    }
  }
  function save() {
    const current = customer.value,
      selected = record.value
    if (!current || !selected || !editing.value || history.value) return
    return mutate(() =>
      saveCustomer(scope, current.id, {
        ...profilePayload(profile, current.customerType),
        version: current.version,
        relationshipId: selected.id,
        relationshipVersion: selected.version,
        nature: current.customerType === 'person' ? relation.nature : undefined
      })
    )
  }
  function removeRelation(selected: Relationship) {
    if (history.value) return
    return mutate(() => deleteRelationship(scope, selected))
  }
  onScopeDispose(() => {
    disposed = true
    generation++
  })
  return {
    scope,
    open,
    loading,
    failed,
    busy,
    editing,
    customer,
    history,
    record,
    selectedId,
    profile,
    relation,
    select,
    retry,
    close,
    save,
    removeRelation
  }
}
