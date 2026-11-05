import { requestErrorMessage } from '../../utils/requestError'
import { computed, onMounted, onScopeDispose, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import {
  deleteDictionaryItem,
  deleteDictionaryType,
  getDictionaryItems,
  getDictionaryTypes,
  saveDictionaryItem,
  saveDictionaryType,
  type DictionaryItem,
  type DictionaryType
} from '../../api/archive'
export function useDictionaryManager() {
  const { t } = useI18n()
  const types = ref<DictionaryType[]>([])
  const items = ref<DictionaryItem[]>([])
  const selectedCode = ref('')
  const loading = ref(false)
  const failed = ref(false)
  const busy = ref(false)
  const editor = ref<'type' | 'item'>()
  const model = reactive({
    id: undefined as string | undefined,
    version: undefined as number | undefined,
    code: '',
    name: '',
    value: '',
    text: '',
    enabled: true,
    sortIndex: 0,
    description: ''
  })
  const selected = computed(() => types.value.find((type) => type.code === selectedCode.value))
  let generation = 0
  let disposed = false
  async function reloadTypes() {
    loading.value = true
    failed.value = false
    try {
      const result = await getDictionaryTypes()
      if (disposed) return
      types.value = [...result].sort((a, b) => (a.sortIndex || 0) - (b.sortIndex || 0))
      if (!result.some((type) => type.code === selectedCode.value)) selectedCode.value = result[0]?.code || ''
    } catch {
      if (!disposed) failed.value = true
    } finally {
      if (!disposed) loading.value = false
    }
  }
  async function reloadItems() {
    const token = ++generation
    items.value = []
    if (!selectedCode.value) return
    loading.value = true
    failed.value = false
    try {
      const result = await getDictionaryItems(selectedCode.value)
      if (!disposed && token === generation)
        items.value = [...result].sort((a, b) => (a.sortIndex || 0) - (b.sortIndex || 0))
    } catch {
      if (!disposed && token === generation) failed.value = true
    } finally {
      if (!disposed && token === generation) loading.value = false
    }
  }
  function editType(value?: DictionaryType) {
    Object.assign(model, {
      id: value?.id,
      version: value?.version,
      code: value?.code || '',
      name: value?.name || '',
      enabled: value?.enabled ?? true,
      sortIndex: value?.sortIndex || 0,
      description: value?.description || ''
    })
    editor.value = 'type'
  }
  function editItem(value?: DictionaryItem) {
    Object.assign(model, {
      id: value?.id,
      version: value?.version,
      value: value?.value || '',
      text: value?.text || '',
      enabled: value?.enabled ?? true,
      sortIndex: value?.sortIndex || 0,
      description: value?.description || ''
    })
    editor.value = 'item'
  }
  async function mutate(action: () => Promise<unknown>, callback?: () => void) {
    if (busy.value) return
    busy.value = true
    try {
      await action()
      if (disposed) return
      callback?.()
      await reloadTypes()
      await reloadItems()
      onlyMessage(t('Archive.dictionarySaved'), 'success')
    } catch (cause) {
      if (!disposed) {
        onlyMessage(requestErrorMessage(cause, t('Archive.saveFailed')), 'error')
      }
    } finally {
      if (!disposed) busy.value = false
    }
  }
  function save() {
    const code = selectedCode.value
    return mutate(
      () =>
        editor.value === 'type'
          ? saveDictionaryType({
              id: model.id,
              version: model.version,
              code: model.code.trim(),
              name: model.name.trim(),
              enabled: model.enabled,
              sortIndex: model.sortIndex,
              description: model.description
            })
          : saveDictionaryItem(code, {
              id: model.id,
              version: model.version,
              value: model.value.trim(),
              text: model.text.trim(),
              enabled: model.enabled,
              sortIndex: model.sortIndex,
              description: model.description
            }),
      () => {
        editor.value = undefined
      }
    )
  }
  const toggleType = (value: DictionaryType, enabled: boolean) =>
    mutate(() => saveDictionaryType({ ...value, enabled }))
  const toggleItem = (value: DictionaryItem, enabled: boolean) =>
    mutate(() => saveDictionaryItem(value.typeCode, { ...value, enabled }))
  const removeType = (value: DictionaryType) => mutate(() => deleteDictionaryType(value))
  const removeItem = (value: DictionaryItem) => mutate(() => deleteDictionaryItem(value))
  watch(selectedCode, () => {
    void reloadItems()
  })
  onMounted(() => {
    void reloadTypes()
  })
  onScopeDispose(() => {
    disposed = true
    generation++
  })
  return {
    types,
    items,
    selectedCode,
    selected,
    loading,
    failed,
    busy,
    editor,
    model,
    reloadTypes,
    reloadItems,
    editType,
    editItem,
    save,
    toggleType,
    toggleItem,
    removeType,
    removeItem
  }
}
