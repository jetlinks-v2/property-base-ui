<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CustomerType, Query, Scope } from '../../../api/archive'
import { useArchiveExcel } from '../../../hooks/archive/useArchiveExcel'
import ArchiveImportDialog from './ArchiveImportDialog.vue'
const props = defineProps<{
  kind: 'house' | 'customer'
  scope: Scope
  projectName?: string
  query: Query
  history?: boolean
}>()
const emit = defineEmits<{ imported: [] }>()
const { t } = useI18n()
const open = ref(false)
const { busy, template, upload, download } = useArchiveExcel(
  () => props,
  () => emit('imported')
)
function showImport() {
  open.value = true
}
async function submit(file: File, customerType?: CustomerType) {
  if (await upload(file, customerType)) open.value = false
}
</script>
<template>
  <a-space>
    <j-permission-button
      v-if="!history"
      :hasPermission="`charging/${kind === 'house' ? 'Space' : 'Customer'}:import`"
      :disabled="busy"
      @click="showImport"
    >
      <template #icon><AIcon type="ImportOutlined" /></template>
      {{ t('Archive.import') }}
    </j-permission-button>
    <j-permission-button
      :hasPermission="`charging/${kind === 'house' ? 'Space' : 'Customer'}:export`"
      :loading="busy"
      @click="download"
    >
      <template #icon><AIcon type="ExportOutlined" /></template>
      {{ t('Archive.export') }}
    </j-permission-button>
  </a-space>
  <ArchiveImportDialog
    :open="open"
    :project-name="projectName || scope.projectId"
    :kind="kind"
    :busy="busy"
    @close="open = false"
    @template="template"
    @upload="submit"
  />
</template>
