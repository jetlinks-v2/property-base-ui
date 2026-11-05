<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { usePermission } from '@jetlinks-web/hooks'
import { FullPage } from '@jetlinks-web-core/layout'
import { useDictionaryManager } from '../../../hooks/archive/useDictionaryManager'
import { dictionaryCodes } from '../../../hooks/archive/useDictionaries'
import DictionaryEditor from './DictionaryEditor.vue'
import type { Query } from '../../../api/archive'
const { t } = useI18n()
const k = 'Archive.'
const { hasPerm } = usePermission('charging/Dictionary:save')
const state = useDictionaryManager()
const table = ref<{ reload: () => void }>()
const {
  types,
  items,
  selectedCode,
  selected,
  loading,
  failed,
  busy,
  editType,
  editItem,
  toggleType,
  toggleItem,
  removeType,
  removeItem,
  reloadTypes,
  reloadItems
} = state
// 字典接口返回完整选项；复用表格分页协议做本地切页，修改后仍沿用当前页。
const request = async ({ pageIndex = 0, pageSize = 12 }: Query) => ({
  success: true,
  result: {
    pageIndex,
    pageSize,
    total: items.value.length,
    data: items.value.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
  }
})
watch(items, () => table.value?.reload())
watch(failed, (value) => {
  if (value) onlyMessage(t(k + 'dictionaryFailed'), 'error')
})
const columns = computed(() => [
  { title: t(k + 'itemText'), dataIndex: 'text', width: 180 },
  { title: t(k + 'itemValue'), dataIndex: 'value', width: 160 },
  { title: t(k + 'sortIndex'), dataIndex: 'sortIndex', width: 80 },
  { title: t(k + 'description'), dataIndex: 'description', ellipsis: true, width: 220 },
  { title: t(k + 'status'), dataIndex: 'enabled', scopedSlots: true, width: 110 },
  { title: t(k + 'actions'), dataIndex: 'actions', scopedSlots: true, width: 170 }
])
const selectType = (keys: (string | number)[]) => {
  if (keys.length) selectedCode.value = String(keys[0])
}
const refresh = () => {
  void reloadTypes()
  void reloadItems()
}
</script>
<template>
  <j-page-container>
    <FullPage
      hasPadding
      transparentBackground
    >
      <div class="archive-workspace">
        <div class="archive-toolbar">
          <j-permission-button
            hasPermission="charging/Dictionary:save"
            type="primary"
            @click="editType()"
          >
            {{ t(k + 'addDictionaryType') }}
          </j-permission-button>
          <a-button
            class="archive-refresh"
            @click="refresh"
          >
            <template #icon>
              <AIcon type="ReloadOutlined" />
            </template>
            {{ t(k + 'refresh') }}
          </a-button>
        </div>
        <div class="archive-split">
          <aside class="archive-tree">
            <a-spin :spinning="loading">
              <a-tree
                v-if="types.length"
                :tree-data="
                  types.map((type) => ({
                    key: type.code,
                    title: type.name + (type.enabled ? '' : ' · ' + t(k + 'disabled'))
                  }))
                "
                :selected-keys="[selectedCode]"
                block-node
                @select="selectType"
              />
              <CloudEmpty
                v-else
                :description="t(k + 'noDictionaryTypes')"
              />
            </a-spin>
          </aside>
          <main class="archive-main">
            <template v-if="selected">
              <div class="archive-path">
                <strong>{{ selected.name }}</strong>
                <a-tag>{{ selected.code }}</a-tag>
                <a-switch
                  :checked="selected.enabled"
                  :disabled="busy || !hasPerm"
                  @change="(value) => toggleType(selected!, value === true)"
                />
                <j-permission-button
                  hasPermission="charging/Dictionary:save"
                  type="link"
                  @click="editType(selected)"
                >
                  {{ t(k + 'edit') }}
                </j-permission-button>
                <a-popconfirm
                  :title="t(k + 'deleteDictionaryConfirm')"
                  @confirm="removeType(selected!)"
                >
                  <j-permission-button
                    hasPermission="charging/Dictionary:delete"
                    type="link"
                    danger
                  >
                    {{ t(k + 'delete') }}
                  </j-permission-button>
                </a-popconfirm>
              </div>
              <div class="archive-actions">
                <j-permission-button
                  hasPermission="charging/Dictionary:save"
                  :disabled="!selected.enabled"
                  @click="editItem()"
                >
                  {{ t(k + 'addDictionaryItem') }}
                </j-permission-button>
              </div>
              <j-pro-table
                :key="selectedCode"
                ref="table"
                row-key="id"
                mode="TABLE"
                type="PAGE"
                :columns="columns"
                :request="request"
                :loading="loading"
                :no-pagination="false"
                :pagination="{ pageSize: 12 }"
                :alert-show="false"
                :body-style="{ padding: 0 }"
              >
                <template #enabled="record">
                  <a-switch
                    :checked="record.enabled"
                    :disabled="busy || !hasPerm"
                    @change="(value) => toggleItem(record, value === true)"
                  />
                </template>
                <template #actions="record">
                  <a-space>
                    <j-permission-button
                      hasPermission="charging/Dictionary:save"
                      type="link"
                      @click="editItem(record)"
                    >
                      {{ t(k + 'edit') }}
                    </j-permission-button>
                    <a-popconfirm
                      :title="t(k + 'deleteDictionaryItemConfirm')"
                      @confirm="removeItem(record)"
                    >
                      <j-permission-button
                        hasPermission="charging/Dictionary:delete"
                        type="link"
                        danger
                      >
                        {{ t(k + 'delete') }}
                      </j-permission-button>
                    </a-popconfirm>
                  </a-space>
                </template>
                <template #emptyText>
                  <CloudEmpty :description="t(k + (failed ? 'dictionaryFailed' : 'noDictionaryItems'))" />
                </template>
              </j-pro-table>
            </template>
            <CloudEmpty
              v-else
              :description="t(k + 'noDictionaryTypes')"
            >
              <div class="archive-stack">
                <span
                  v-for="code in dictionaryCodes"
                  :key="code"
                >
                  {{ t(k + 'dictionaryCodes.' + code) }} · {{ code }}
                </span>
              </div>
            </CloudEmpty>
          </main>
        </div>
        <DictionaryEditor :state="state" />
      </div>
    </FullPage>
  </j-page-container>
</template>
<style src="../components/archive.css"></style>
