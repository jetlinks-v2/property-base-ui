import { onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { downloadFileByUrl, onlyMessage } from '@jetlinks-web/utils'
import {
  exportCustomers,
  exportHouses,
  getArchiveTemplate,
  importCustomers,
  importHouses,
  type CustomerType,
  type Query,
  type Scope
} from '../../api/archive'
import { validateImportFile } from '../../utils/archiveImport'
import { excelErrorMessage } from '../../utils/archiveFiles'

export function useArchiveExcel(
  getConfig: () => { scope: Scope; projectName?: string; query: Query; kind: 'house' | 'customer'; history?: boolean },
  imported: () => void
) {
  const { t } = useI18n()
  const busy = ref(false)
  let disposed = false
  const name = () => t('Archive.' + (getConfig().kind === 'house' ? 'houses' : 'customers'))
  const report = async (cause: unknown, fallback: string) => {
    const message = await excelErrorMessage(cause, t(fallback))
    if (!disposed) onlyMessage(message, 'error')
  }
  function save(blob: Blob, filename: string) {
    if (disposed) return
    const url = URL.createObjectURL(blob)
    try {
      downloadFileByUrl(url, filename, 'xlsx')
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }
  async function template(customerType?: CustomerType) {
    if (busy.value) return
    busy.value = true
    const { scope, projectName, kind } = getConfig()
    try {
      if (!scope.projectId) throw new Error(t('Archive.importProjectRequired'))
      if (kind === 'customer' && !customerType) throw new Error(t('Archive.importTypeRequired'))
      const blob = await getArchiveTemplate({ projectId: scope.projectId }, kind, customerType)
      const typeName = kind === 'customer' ? t('Archive.' + customerType) : name()
      save(blob, `${projectName || scope.projectId}-${typeName}-${t('Archive.template')}`)
    } catch (cause) {
      await report(cause, 'Archive.exportFailed')
    } finally {
      if (!disposed) busy.value = false
    }
  }
  async function upload(file: File, customerType?: CustomerType): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    const { scope, kind } = getConfig()
    try {
      if (!scope.projectId) throw new Error(t('Archive.importProjectRequired'))
      if (kind === 'customer' && !customerType) throw new Error(t('Archive.importTypeRequired'))
      const invalid = validateImportFile(file)
      if (invalid) throw new Error(t('Archive.' + (invalid === 'format' ? 'importFormat' : 'importSize')))
      const project = { projectId: scope.projectId }
      const result =
        kind === 'house' ? await importHouses(project, file) : await importCustomers(project, file, customerType!)
      if (!disposed) {
        imported()
        onlyMessage(t('Archive.imported', { count: result.count }), 'success')
      }
      return !disposed
    } catch (cause) {
      await report(cause, 'Archive.importFailed')
      return false
    } finally {
      if (!disposed) busy.value = false
    }
  }
  async function download() {
    if (busy.value) return
    busy.value = true
    const { scope, query, kind, history = false } = getConfig()
    try {
      if (!scope.projectId) throw new Error(t('Archive.importProjectRequired'))
      const blob = kind === 'house' ? await exportHouses(scope, query) : await exportCustomers(scope, query, history)
      save(blob, name())
    } catch (cause) {
      await report(cause, 'Archive.exportFailed')
    } finally {
      if (!disposed) busy.value = false
    }
  }
  onScopeDispose(() => {
    disposed = true
  })
  return { busy, template, upload, download }
}
