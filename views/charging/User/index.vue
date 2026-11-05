<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { FullPage } from '@jetlinks-web-core/layout'
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import type { ConditionTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { useUserList } from '../../../hooks/useUserList'
import { useUserDetail, userPermission } from '../../../hooks/useUserDetail'
import { useUserSync } from '../../../hooks/useUserSync'
import UserDetail from './UserDetail.vue'
import UserTable from './UserTable.vue'
import type { UserTerm } from '../../../api/user'
const { t } = useI18n()
const k = 'UserManagement.'
const {
  table,
  tab,
  filters,
  searchTerms,
  organizationId,
  includeChildren,
  organizations,
  identities,
  optionsFailed,
  failed,
  countsFailed,
  counts,
  params,
  request,
  refreshCounts,
  loadOptions,
  reload,
  resetFilters
} = useUserList()
const detail = useUserDetail(reload)
const sync = useUserSync(reload)
const { status, statusFailed, running, refreshStatus, synchronize } = sync
const {
  open,
  detail: user,
  loading: detailLoading,
  failed: detailFailed,
  saveError,
  saved,
  saving,
  editable,
  readOnly,
  select,
  mark,
  retry,
  close,
  save
} = detail
watch(failed, (value) => {
  if (value) onlyMessage(t(k + 'loadFailed'), 'error')
})
watch(
  () => statusFailed.value || status.value?.status === 'failed',
  (value) => {
    if (value) onlyMessage(t(k + (statusFailed.value ? 'statusFailed' : 'syncFailed')), 'error')
  }
)
const date = (value?: number) => (value ? new Date(value).toLocaleString() : t(k + 'never'))
const fields = computed(() => [
  { title: t(k + 'name'), dataIndex: 'name', search: { type: 'string' } },
  { title: t(k + 'username'), dataIndex: 'username', search: { type: 'string' } },
  { title: t(k + 'telephone'), dataIndex: 'telephone', search: { type: 'string' } },
  {
    title: t(k + 'status'),
    dataIndex: 'status',
    search: {
      type: 'select',
      options: [
        { label: t(k + 'enabled'), value: 1 },
        { label: t(k + 'disabled'), value: 0 }
      ]
    }
  }
])
const tabs = ['all', 'owner', 'employee', 'unmarked'] as const
const changeFilters = ({ filter }: { filter: { terms?: ConditionTerm[] } }) => {
  filters.value = (filter.terms || []) as UserTerm[]
}
const onRefresh = () => {
  reload()
  void refreshStatus()
  void loadOptions()
}
</script>

<template>
  <j-page-container>
    <FullPage
      hasPadding
      transparentBackground
    >
      <div class="user-workspace">
        <div class="user-toolbar">
          <span class="user-sync-time">{{ t(k + 'lastSync') }}：{{ date(status?.lastSuccessTime) }}</span>
          <a-button @click="onRefresh">
            <template #icon><AIcon type="ReloadOutlined" /></template>
            {{ t(k + 'refresh') }}
          </a-button>
          <j-permission-button
            :hasPermission="`${userPermission}:sync`"
            type="primary"
            :loading="running"
            @click="synchronize"
          >
            <template #icon><AIcon type="SyncOutlined" /></template>
            {{ t(k + (running ? 'syncing' : 'sync')) }}
          </j-permission-button>
        </div>
        <div class="user-content">
          <div class="user-tabs">
            <a-tabs v-model:activeKey="tab">
              <a-tab-pane
                v-for="item in tabs"
                :key="item"
              >
                <template #tab>
                  <span>
                    {{ t(k + 'tabs.' + item) }}
                    <span class="user-tab-count">{{ counts?.[item] ?? '—' }}</span>
                  </span>
                </template>
              </a-tab-pane>
            </a-tabs>
            <a-button
              v-if="countsFailed"
              size="small"
              type="link"
              @click="refreshCounts"
            >
              {{ t(k + 'retryCounts') }}
            </a-button>
          </div>
          <div class="user-filters">
            <ConditionFilter
              v-model="searchTerms"
              :fields="fields"
              @change="changeFilters"
            />
            <div class="user-org-filter">
              <a-tree-select
                v-model:value="organizationId"
                :tree-data="organizations"
                :field-names="{ label: 'name', value: 'id', children: 'children' }"
                :placeholder="t(k + 'allOrganizations')"
                :aria-label="t(k + 'organization')"
                allow-clear
                show-search
                tree-node-filter-prop="name"
              />
              <a-checkbox v-model:checked="includeChildren">{{ t(k + 'includeChildren') }}</a-checkbox>
              <a-button
                v-if="optionsFailed"
                type="link"
                @click="loadOptions"
              >
                {{ t(k + 'retryOptions') }}
              </a-button>
            </div>
          </div>
          <UserTable
            ref="table"
            :params="params"
            :request="request"
            :state="{
              failed,
              hasSynced: !!status?.lastSuccessTime,
              canReset: !!filters.length || !!organizationId || tab !== 'all'
            }"
            @select="select"
            @mark="mark"
            @reset="resetFilters"
          />
        </div>
      </div>
      <UserDetail
        :open="open"
        :user="user"
        :identities="identities"
        :state="{ loading: detailLoading, failed: detailFailed, editable, readOnly, saving, saved, saveError }"
        @close="close"
        @retry="retry"
        @save="save"
      />
    </FullPage>
  </j-page-container>
</template>

<style scoped src="./index.css"></style>
