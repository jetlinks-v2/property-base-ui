import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePermission } from '@jetlinks-web/hooks'
import { onlyMessage } from '@jetlinks-web/utils'
import { getFileUrlById } from '@jetlinks-web-core/api/comm'
import { setProjectSeal, uploadProjectSeal, type PropertyOrganization } from '../api/organization'
import { requestErrorMessage } from '../utils/requestError'

/** 上传和保存属于同一次选择；切换组织或卸载后不得把旧结果写入新组织。 */
export function useProjectSeal(
  organization: Ref<PropertyOrganization>,
  onSaved: (value: PropertyOrganization) => void,
  onStale: () => void
) {
  const { t } = useI18n()
  const { hasPerm } = usePermission('charging/OrganizationType:seal')
  const busy = ref(false)
  const imageFailed = ref(false)
  let generation = 0
  const isProject = computed(() => organization.value.organizationType?.value === 'project')
  const imageUrl = computed(() =>
    organization.value.projectSealFileId ? getFileUrlById(organization.value.projectSealFileId) : ''
  )
  const canMaintain = computed(() => hasPerm.value && isProject.value && !busy.value)
  watch(
    () => organization.value.id,
    () => {
      generation++
      busy.value = false
    }
  )
  watch(imageUrl, () => {
    imageFailed.value = false
  })
  onScopeDispose(() => {
    generation++
  })

  async function persist(file: File | null) {
    if (!canMaintain.value) return
    if (file && (!['image/png', 'image/jpeg'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024)) {
      onlyMessage(t('ProjectSeal.invalidFile'), 'error')
      return
    }
    const current = organization.value
    const token = ++generation
    busy.value = true
    let saveStarted = false
    try {
      let fileId: string | null = null
      if (file) {
        const response = await uploadProjectSeal(file)
        if (token !== generation) return
        if (!response.success || !response.result?.id) throw response
        fileId = response.result.id
      }
      saveStarted = true
      const response = await setProjectSeal(current.id, fileId, current.version)
      if (token !== generation) return
      if (!response.success) throw response
      onSaved(response.result)
      onlyMessage(t(file ? 'ProjectSeal.saved' : 'ProjectSeal.removed', { name: current.name }), 'success')
    } catch (error) {
      if (token !== generation) return
      onlyMessage(requestErrorMessage(error, t('ProjectSeal.saveFailed')), 'error')
      // 写入冲突或网络结果不确定时刷新详情，不重复提交，保留服务端真实状态。
      if (saveStarted) onStale()
    } finally {
      if (token === generation) busy.value = false
    }
  }

  return { busy, isProject, imageFailed, imageUrl, canMaintain, persist }
}
