import { computed, onMounted, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { getUserSyncStatus, synchronizeUsers, type UserSyncStatus } from '../api/user'

/** 所有页面实例查询同一个最近任务；失败显式重试，不在网络异常后无限轮询。 */
export function useUserSync(onCompleted: () => void) {
  const { t } = useI18n()
  const status = ref<UserSyncStatus>()
  const statusFailed = ref(false)
  const submitting = ref(false)
  const running = computed(() => submitting.value || !!status.value?.running)
  let disposed = false
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let observedTask: string | undefined

  async function refreshStatus() {
    const token = ++generation
    if (timer) clearTimeout(timer)
    try {
      const response = await getUserSyncStatus()
      if (disposed || token !== generation) return
      if (!response.success) throw new Error('User sync status rejected')
      const previous = status.value
      status.value = response.result
      statusFailed.value = false
      if (response.result.running) {
        observedTask = response.result.taskId
        timer = setTimeout(() => {
          void refreshStatus()
        }, 2000)
      } else if ((previous?.running || observedTask === response.result.taskId) && observedTask) {
        observedTask = undefined
        if (response.result.status === 'succeeded') {
          onlyMessage(
            t('UserManagement.syncSuccess', {
              added: response.result.added ?? 0,
              updated: response.result.updated ?? 0,
              deleted: response.result.deleted ?? 0
            }),
            'success'
          )
          onCompleted()
        }
      }
    } catch {
      if (!disposed && token === generation) statusFailed.value = true
    }
  }

  async function synchronize() {
    if (running.value) return
    submitting.value = true
    try {
      const response = await synchronizeUsers()
      if (disposed) return
      if (!response.success) throw new Error('User sync rejected')
      status.value = response.result
      observedTask = response.result.taskId
    } catch {
      if (!disposed) onlyMessage(t('UserManagement.syncSubmitFailed'), 'error')
    } finally {
      if (!disposed) {
        submitting.value = false
        await refreshStatus()
      }
    }
  }

  onMounted(() => {
    void refreshStatus()
  })
  onScopeDispose(() => {
    disposed = true
    generation++
    if (timer) clearTimeout(timer)
  })
  return { status, statusFailed, running, refreshStatus, synchronize }
}
