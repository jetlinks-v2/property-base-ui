import { requestErrorMessage } from '../../utils/requestError'
import { onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { getHouse, saveHouse, type House, type HouseInput, type Scope } from '../../api/archive'
export function useHouseEditor(scope: Scope, reload: () => void) {
  const { t } = useI18n()
  const open = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const failed = ref(false)
  const house = ref<House>()
  const selectedId = ref('')
  const readOnly = ref(false)
  let generation = 0
  let disposed = false
  async function select(spaceId: string, readonly = false) {
    const token = ++generation
    selectedId.value = spaceId
    readOnly.value = readonly
    open.value = true
    loading.value = true
    failed.value = false
    house.value = undefined
    try {
      const result = await getHouse(scope, spaceId)
      if (!disposed && token === generation) house.value = result
    } catch {
      if (!disposed && token === generation) failed.value = true
    } finally {
      if (!disposed && token === generation) loading.value = false
    }
  }
  function close() {
    generation++
    open.value = false
    house.value = undefined
  }
  async function save(input: HouseInput) {
    if (!house.value || saving.value || readOnly.value) return
    const current = house.value
    const token = generation
    saving.value = true
    try {
      const result = await saveHouse(scope, current.spaceId, { ...input, version: current.version })
      if (disposed || token !== generation) return
      house.value = result
      reload()
      close()
      onlyMessage(t('Archive.houseSaved', { name: current.name }), 'success')
    } catch (cause) {
      if (!disposed && token === generation) onlyMessage(requestErrorMessage(cause, t('Archive.saveFailed')), 'error')
    } finally {
      if (!disposed) saving.value = false
    }
  }
  onScopeDispose(() => {
    disposed = true
    generation++
  })
  return { open, loading, saving, failed, house, selectedId, readOnly, select, close, save }
}
