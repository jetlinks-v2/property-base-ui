<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { FullPage } from '@jetlinks-web-core/layout'
import OrganizationDetail from './OrganizationDetail.vue'
import { organizationPermission, useOrganizationType } from '../../../hooks/useOrganizationType'

const { t } = useI18n()
const key = 'OrganizationType.'
const {
  types,
  status,
  keyword,
  unmarkedOnly,
  selectedId,
  expandedKeys,
  detail,
  loading,
  failed,
  statusFailed,
  detailLoading,
  detailFailed,
  saving,
  organizations,
  visibleTree,
  unmarkedCount,
  parentName,
  syncRunning,
  editable,
  dateText,
  acceptDetail,
  select,
  refreshStatus,
  reload,
  save,
  synchronize
} = useOrganizationType()
watch(failed, (value) => {
  if (value) onlyMessage(t(key + 'loadFailed'), 'error')
})
watch(
  () =>
    statusFailed.value ||
    !!(
      status.value?.lastFailureTime &&
      (!status.value.lastSuccessTime || status.value.lastFailureTime > status.value.lastSuccessTime)
    ),
  (value) => {
    if (value) onlyMessage(t(key + (statusFailed.value ? 'statusFailed' : 'syncFailed')), 'error')
  }
)
const onSelect = (keys: (string | number)[]) => {
  if (keys.length) void select(String(keys[0]))
}
const onRefresh = () => {
  reload()
  refreshStatus()
}
const clearFilters = () => {
  keyword.value = ''
  unmarkedOnly.value = false
}
</script>

<template>
  <j-page-container>
    <FullPage
      hasPadding
      transparentBackground
    >
      <div class="organization-workspace">
        <header class="organization-toolbar">
          <div class="organization-toolbar__actions">
            <span class="organization-sync-time">
              {{ t(key + 'lastSync') }}：{{ dateText(status?.lastSuccessTime) }}
            </span>
            <a-button
              :disabled="loading || saving || syncRunning"
              @click="onRefresh"
            >
              <template #icon><AIcon type="ReloadOutlined" /></template>
              {{ t(key + 'refresh') }}
            </a-button>
            <j-permission-button
              :hasPermission="`${organizationPermission}:sync`"
              type="primary"
              :loading="syncRunning"
              :disabled="loading || saving"
              @click="synchronize"
            >
              <template #icon><AIcon type="SyncOutlined" /></template>
              {{ t(key + 'sync') }}
            </j-permission-button>
          </div>
        </header>
        <div class="organization-panels">
          <aside class="organization-tree">
            <h2>{{ t(key + 'tree') }}</h2>
            <a-input
              v-model:value="keyword"
              :placeholder="t(key + 'search')"
              :aria-label="t(key + 'search')"
              allow-clear
            />
            <a-checkbox v-model:checked="unmarkedOnly">{{ t(key + 'unmarkedOnly') }}</a-checkbox>
            <a-spin
              :spinning="loading"
              class="organization-tree__body"
            >
              <a-tree
                v-if="visibleTree.length"
                :tree-data="visibleTree"
                :selected-keys="selectedId ? [selectedId] : []"
                v-model:expandedKeys="expandedKeys"
                :auto-expand-parent="false"
                block-node
                :disabled="saving"
                @select="onSelect"
              >
                <template #title="node">
                  <div
                    class="organization-tree__node"
                    :class="{ 'organization-tree__context': node.contextOnly }"
                  >
                    <span
                      class="organization-tree__name"
                      :title="node.name"
                    >
                      {{ node.name }}
                    </span>
                    <a-tag
                      v-if="node.organizationType"
                      :color="node.organizationType.value === 'project' ? 'blue' : 'purple'"
                    >
                      {{ node.organizationType.text }}
                    </a-tag>
                    <span
                      v-else
                      class="organization-tree__unmarked"
                    >
                      {{ t(key + 'unmarked') }}
                    </span>
                  </div>
                </template>
              </a-tree>
              <CloudEmpty
                v-else-if="!loading"
                :description="t(key + (organizations.length ? 'noMatches' : failed ? 'loadFailed' : 'empty'))"
              >
                <a-button
                  v-if="organizations.length"
                  @click="clearFilters"
                >
                  {{ t(key + 'clearFilter') }}
                </a-button>
              </CloudEmpty>
            </a-spin>
          </aside>
          <main
            class="organization-content"
            :aria-busy="detailLoading || saving"
          >
            <div
              v-if="detailLoading"
              class="organization-content__loading"
              role="status"
            >
              <a-spin />
            </div>
            <template v-else>
              <a-result
                v-if="detailFailed"
                status="warning"
                :title="t(key + 'detailFailed')"
              >
                <template #extra>
                  <a-button @click="select(selectedId)">{{ t(key + 'retry') }}</a-button>
                </template>
              </a-result>
              <OrganizationDetail
                v-else-if="detail"
                :organization="detail"
                :date-text="dateText"
                :state="{ editable, saving, types, parentName }"
                @save="save"
                @updated="acceptDetail"
                @refresh="select(selectedId)"
              />
              <CloudEmpty
                v-else-if="!detailLoading"
                class="organization-content__empty"
                :description="t(key + 'selectOrganization')"
              />
            </template>
          </main>
        </div>
      </div>
    </FullPage>
  </j-page-container>
</template>

<style scoped src="./index.css"></style>
