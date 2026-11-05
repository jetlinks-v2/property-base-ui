<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { requestErrorMessage } from '../../../utils/requestError'
import ConditionFilter, { type ConditionFilterChangePayload } from '@jetlinks-web-core/components/ConditionFilter'
import { checked, deleteHouse, queryHouses, type House, type Query, type Scope, type Space } from '../../../api/archive'
import { useDictionaries } from '../../../hooks/archive/useDictionaries'
import { useHouseEditor } from '../../../hooks/archive/useHouseEditor'
import HouseEditor from './HouseEditor.vue'
import ExcelActions from '../components/ExcelActions.vue'
const props = defineProps<{ scope: Scope; space?: Space; projectName?: string }>()
const { t } = useI18n()
const k = 'Archive.'
const table = ref<{ reload: () => void }>()
const reload = () => table.value?.reload()
const {
  open,
  house,
  selectedId,
  readOnly,
  loading,
  saving,
  failed: detailFailed,
  select,
  close,
  save
} = useHouseEditor(props.scope, reload)
const dictionary = useDictionaries()
const failed = ref(false)
watch(failed, (value) => {
  if (value) onlyMessage(t(k + 'loadFailed'), 'error')
})
const terms = ref([])
const params = ref<Query>({ terms: [] })
const fields = computed(() => [
  { title: t(k + 'spaceName'), dataIndex: 'name', search: { type: 'string' } },
  {
    title: t(k + 'completed'),
    dataIndex: 'completed',
    search: {
      type: 'select',
      options: [
        { label: t(k + 'complete'), value: true },
        { label: t(k + 'incomplete'), value: false }
      ]
    }
  },
  {
    title: t(k + 'houseType'),
    dataIndex: 'houseType',
    search: { type: 'select', options: dictionary.options('house-type') }
  },
  {
    title: t(k + 'houseState'),
    dataIndex: 'houseState',
    search: { type: 'select', options: dictionary.options('house-state') }
  }
])
const columns = computed(() => [
  { title: t(k + 'spaceName'), dataIndex: 'name', scopedSlots: true, width: 120 },
  { title: t(k + 'spacePath'), dataIndex: 'fullName', width: 320, ellipsis: true, columnEmpty: '—' },
  { title: t(k + 'completed'), dataIndex: 'completed', scopedSlots: true, width: 110 },
  { title: t(k + 'houseType'), dataIndex: 'houseType', scopedSlots: true, width: 110 },
  { title: t(k + 'houseState'), dataIndex: 'houseState', scopedSlots: true, width: 110 },
  { title: t(k + 'billingArea'), dataIndex: 'billingArea', width: 130 },
  { title: t(k + 'actions'), dataIndex: 'actions', scopedSlots: true, width: 280 }
])
async function request(query: Query, context?: { signal: AbortSignal }) {
  failed.value = false
  try {
    const response = await queryHouses(props.scope, query, context?.signal)
    checked(response)
    return response
  } catch (cause) {
    if (!context?.signal.aborted) failed.value = true
    throw cause
  }
}
const change = ({ filter }: ConditionFilterChangePayload) => {
  params.value = { terms: filter.terms as Query['terms'] }
}
async function remove(record: House) {
  try {
    await deleteHouse(props.scope, record)
    reload()
    onlyMessage(t(k + 'houseDeleted', { name: record.name }), 'success')
  } catch (cause) {
    onlyMessage(requestErrorMessage(cause, t(k + 'saveFailed')), 'error')
  }
}
</script>
<template>
  <ConditionFilter
    v-model="terms"
    :fields="fields"
    @change="change"
  />
  <div class="archive-actions">
    <ExcelActions
      :project-name="projectName"
      kind="house"
      :scope="scope"
      :query="params"
      @imported="reload"
    />
  </div>
  <j-pro-table
    ref="table"
    row-key="id"
    mode="TABLE"
    type="PAGE"
    :columns="columns"
    :params="params"
    :request="request"
    :no-pagination="false"
    :pagination="{ pageSize: 12 }"
    :scroll="{ x: columns.reduce((width, column) => width + column.width, 0) }"
    :alert-show="false"
    :body-style="{ padding: 0 }"
  >
    <template #name="record">
      <b>{{ record.name }}</b>
    </template>
    <template #completed="record">
      <j-badge-status
        :status="record.completed ? 'success' : 'warning'"
        :text="t(k + (record.completed ? 'complete' : 'incomplete'))"
      />
    </template>
    <template #houseType="record">{{ dictionary.text('house-type', record.houseType) }}</template>
    <template #houseState="record">{{ dictionary.text('house-state', record.houseState) }}</template>
    <template #actions="record">
      <div class="archive-row-actions">
        <a-button
          type="link"
          @click="select(record.spaceId, true)"
        >
          {{ t(k + 'detail') }}
        </a-button>
        <j-permission-button
          hasPermission="charging/Space:save"
          type="link"
          @click="select(record.spaceId)"
        >
          {{ t(k + (record.completed ? 'editHouse' : 'completeHouse')) }}
        </j-permission-button>
        <a-popconfirm
          v-if="record.completed"
          :title="t(k + 'deleteHouseConfirm')"
          @confirm="remove(record)"
        >
          <j-permission-button
            hasPermission="charging/Space:delete"
            type="link"
            danger
          >
            {{ t(k + 'delete') }}
          </j-permission-button>
        </a-popconfirm>
      </div>
    </template>
    <template #emptyText><CloudEmpty :description="t(k + (failed ? 'loadFailed' : 'noHouses'))" /></template>
  </j-pro-table>
  <HouseEditor
    :open="open"
    :house="house"
    :state="{ loading, failed: detailFailed, saving, readOnly }"
    @close="close"
    @save="save"
    @retry="select(selectedId, readOnly)"
  />
</template>
