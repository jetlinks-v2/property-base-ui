import { requestErrorMessage } from '../utils/requestError'
import { computed, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePermission } from '@jetlinks-web/hooks'
import { onlyMessage } from '@jetlinks-web/utils'
import { getPropertyUser, setUserIdentities, type PropertyUser, type UserIdentityValue } from '../api/user'
import { sameIdentities } from '../utils/userQuery'

export const userPermission = 'charging/User'

/** 详情及保存分别校验选择代次；切换或关闭抽屉后，旧响应不能改写新用户。 */
export function useUserDetail(onSaved: () => void) {
  const { t } = useI18n()
  const { hasPerm } = usePermission(`${userPermission}:save`)
  const open = ref(false)
  const selectedId = ref('')
  const readOnly = ref(true)
  const detail = ref<PropertyUser>()
  const loading = ref(false)
  const failed = ref(false)
  const saveError = ref(false)
  const saved = ref(false)
  const pending = ref<string[]>([])
  let generation = 0
  let disposed = false
  const saving = computed(() => pending.value.includes(selectedId.value))
  const editable = computed(
    () =>
      !readOnly.value && hasPerm.value && !saving.value && !loading.value && !failed.value && detail.value?.status === 1
  )

  async function select(id: string, mode: 'view' | 'mark' = 'view', preserveFeedback = false) {
    const token = ++generation
    selectedId.value = id
    // 只有“标记身份”入口允许保存；查看详情和用户名称入口始终只读。
    readOnly.value = mode === 'view'
    open.value = true
    detail.value = undefined
    failed.value = false
    loading.value = true
    if (!preserveFeedback) {
      saved.value = false
      saveError.value = false
    }
    try {
      const response = await getPropertyUser(id)
      if (disposed || token !== generation) return
      if (!response.success) throw new Error('User detail rejected')
      detail.value = response.result
    } catch {
      if (!disposed && token === generation) failed.value = true
    } finally {
      if (!disposed && token === generation) loading.value = false
    }
  }

  const mark = (id: string) => select(id, 'mark')
  const retry = () => select(selectedId.value, readOnly.value ? 'view' : 'mark')

  function close() {
    generation++
    open.value = false
    selectedId.value = ''
    detail.value = undefined
    loading.value = false
  }

  async function save(identities: UserIdentityValue[]) {
    const current = detail.value
    if (!current || !editable.value || sameIdentities(current.identities, identities)) return
    const token = generation
    const id = current.id
    pending.value = [...pending.value, id]
    saved.value = false
    saveError.value = false
    try {
      const response = await setUserIdentities(id, identities, current.version)
      if (disposed) return
      if (!response.success) throw new Error('User identity update rejected')
      onSaved()
      if (token === generation) {
        detail.value = response.result
        saved.value = true
      }
      onlyMessage(t('UserManagement.saved', { name: current.name || current.username }), 'success')
    } catch (cause) {
      if (!disposed && token === generation) {
        onlyMessage(requestErrorMessage(cause, t('UserManagement.saveFailed')), 'error')
        saveError.value = true
        // 重新读取最新版本供人确认，不用旧版本自动覆盖重试。
        await select(id, readOnly.value ? 'view' : 'mark', true)
      }
    } finally {
      if (!disposed) pending.value = pending.value.filter((value) => value !== id)
    }
  }

  onScopeDispose(() => {
    disposed = true
    generation++
  })
  return {
    open,
    detail,
    loading,
    failed,
    saveError,
    saved,
    saving,
    editable,
    readOnly,
    selectedId,
    select,
    mark,
    retry,
    close,
    save
  }
}
