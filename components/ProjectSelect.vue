<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ProjectTreeNode } from '../utils/projectTree'

/** 纯展示组件：调用方提供组织树并持有选中值；不发起同步或额外请求。 */
const props = defineProps<{ value?: string; treeData: ProjectTreeNode[] }>()
const emit = defineEmits<{ 'update:value': [value: string]; change: [value: string] }>()
const { t } = useI18n()
const findProject = (nodes: ProjectTreeNode[], value: string): boolean =>
  nodes.some((node) => (node.value === value && !node.disabled) || findProject(node.children, value))
const select = (value: string) => {
  if (!findProject(props.treeData, value)) return
  emit('update:value', value)
  emit('change', value)
}
</script>

<template>
  <a-tree-select
    :value="value || undefined"
    :tree-data="treeData"
    tree-default-expand-all
    show-search
    tree-node-filter-prop="title"
    :dropdown-match-select-width="false"
    :dropdown-style="{ width: 'max-content', maxWidth: 'calc(100vw - 32px)', maxHeight: '400px', overflow: 'auto' }"
    :placeholder="t('Archive.selectProject')"
    :aria-label="t('Archive.project')"
    class="property-project-select"
    @change="select"
  />
</template>

<style scoped>
.property-project-select {
  min-width: 15rem;
}
</style>
