<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Space } from '../../../api/archive'
import { FullPage } from '@jetlinks-web-core/layout'
import { onlyMessage } from '@jetlinks-web/utils'
import { useArchiveScope } from '../../../hooks/archive/useArchiveScope'
import ProjectSelect from '../../../components/ProjectSelect.vue'
const { t } = useI18n()
const k = 'Archive.'
const {
  projects,
  projectTree,
  selectProject,
  projectId,
  tree,
  selectedId,
  keyword,
  visibleTree,
  selected,
  scope,
  loading,
  failed,
  syncing,
  status,
  statusFailed,
  loadProjects,
  loadTree,
  synchronize
} = useArchiveScope()
interface TreeNode {
  key: string
  title: string
  children?: TreeNode[]
}
const toTree = (nodes: Space[]): TreeNode[] =>
  nodes.map((node) => ({
    key: node.id,
    title: node.name,
    children: toTree(node.children || [])
  }))
const treeData = computed(() => toTree(visibleTree.value))
// 树选中状态同时决定高亮和空间、客户列表的查询范围。
const selectSpace = (keys: (string | number)[]) => {
  selectedId.value = keys.length ? String(keys[0]) : undefined
}
const sync = async () => {
  try {
    await synchronize()
    onlyMessage(t(k + 'spaceSynced'), 'success')
  } catch {
    onlyMessage(t(k + 'syncFailed'), 'error')
  }
}
watch(failed, (value) => {
  if (value) onlyMessage(t(k + 'scopeFailed'), 'error')
})
watch(
  () =>
    statusFailed.value ||
    !!(
      status.value?.lastFailureTime &&
      (!status.value.lastSuccessTime || status.value.lastFailureTime > status.value.lastSuccessTime)
    ),
  (value) => {
    if (value) onlyMessage(t(k + 'syncFailed'), 'error')
  }
)
const refresh = () => {
  void loadProjects()
  void loadTree()
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
          <ProjectSelect
            :value="projectId || undefined"
            :tree-data="projectTree"
            class="archive-project"
            @change="selectProject"
          />
          <span class="archive-muted">
            {{ t(k + 'lastSync') }}：{{
              status?.lastSuccessTime ? new Date(status.lastSuccessTime).toLocaleString() : '—'
            }}
          </span>
          <a-button @click="refresh">
            <template #icon><AIcon type="ReloadOutlined" /></template>
            {{ t(k + 'refresh') }}
          </a-button>
          <j-permission-button
            hasPermission="charging/Space:sync"
            type="primary"
            :loading="syncing || status?.running"
            @click="sync"
          >
            <AIcon type="SyncOutlined" />
            {{ t(k + 'syncSpaces') }}
          </j-permission-button>
        </div>
        <div
          v-if="projectId"
          class="archive-split"
        >
          <aside class="archive-tree">
            <a-input
              v-model:value="keyword"
              allow-clear
              :placeholder="t(k + 'searchSpace')"
              :aria-label="t(k + 'searchSpace')"
            />
            <a-spin :spinning="loading">
              <a-tree
                v-if="visibleTree.length"
                :key="projectId + keyword"
                :tree-data="treeData"
                :selected-keys="selectedId ? [selectedId] : []"
                default-expand-all
                block-node
                @select="selectSpace"
              />
              <CloudEmpty
                v-else-if="!loading"
                :description="t(k + (failed ? 'scopeFailed' : 'noSpaces'))"
              />
            </a-spin>
          </aside>
          <main class="archive-main">
            <div class="archive-path">
              <strong>{{ selected?.name || projects.find((item) => item.id === projectId)?.name }}</strong>
              <span class="archive-muted">{{ selected?.fullName }}</span>
            </div>
            <slot
              v-if="!loading && !failed"
              :key="projectId + ':' + (selectedId || '')"
              :project-name="projects.find((item) => item.id === projectId)?.name"
              :scope="scope"
              :space="selected"
              :tree="tree"
            />
          </main>
        </div>
        <CloudEmpty
          v-else-if="!loading"
          :description="t(k + (failed ? 'scopeFailed' : 'noProjects'))"
        />
      </div>
    </FullPage>
  </j-page-container>
</template>
<style src="./archive.css"></style>
