<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import type { OrganizationTypeValue } from '../../../api/organization'
import { useOrganizationSpaces } from '../../../hooks/archive/useOrganizationSpaces'
interface TreeNode {
  key: string
  title: string
  children?: TreeNode[]
}
const toTree = (nodes: import('../../../api/archive').Space[]): TreeNode[] =>
  nodes.map((node) => ({
    key: node.id,
    title: node.spaceTypeName ? `${node.name} · ${node.spaceTypeName}` : node.name,
    children: toTree(node.children || [])
  }))
const props = defineProps<{ organizationId: string; organizationType?: OrganizationTypeValue; disabled: boolean }>()
const emit = defineEmits<{ (event: 'type-lock-change', locked: boolean): void }>()
const { t } = useI18n()
const k = 'Archive.'
const {
  loading,
  failed,
  saving,
  selected,
  bound,
  options,
  canBind,
  save,
  bind,
  synchronize,
  editing,
  previewOpen,
  treeLoading,
  treeFailed,
  tree,
  openEditor,
  preview
} = useOrganizationSpaces(
  () => props.organizationId,
  () => props.organizationType,
  () => !props.disabled
)
const treeData = computed(() => toTree(tree.value))
watch(
  () => loading.value || failed.value || saving.value || !!bound.value.length,
  (locked) => emit('type-lock-change', locked),
  { immediate: true }
)
watch(failed, (value) => {
  if (value) onlyMessage(t(k + 'rootsFailed'), 'error')
})
watch(treeFailed, (value) => {
  if (value) onlyMessage(t(k + 'spaceTreeFailed'), 'error')
})
</script>

<template>
  <section class="organization-spaces">
    <header class="organization-spaces__heading">
      <h3>{{ t(k + 'boundSpaces') }}</h3>
      <div class="organization-spaces__actions">
        <j-permission-button
          hasPermission="charging/OrganizationType:spaceSync"
          type="primary"
          :loading="saving"
          :disabled="disabled || loading"
          @click="synchronize"
        >
          <template #icon><AIcon type="SyncOutlined" /></template>
          {{ t(k + 'syncSpaces') }}
        </j-permission-button>
        <j-permission-button
          v-if="!bound.length"
          hasPermission="charging/OrganizationType:bind"
          :disabled="!canBind"
          @click="openEditor"
        >
          <template #icon><AIcon type="PlusOutlined" /></template>
          {{ t(k + 'associateSpace') }}
        </j-permission-button>
      </div>
    </header>
    <a-alert
      v-if="bound.length > 1"
      type="warning"
      show-icon
      :message="t(k + 'multipleBindings')"
    />
    <a-spin :spinning="loading">
      <EntityCard
        v-for="root in bound"
        :key="root.id"
        class="organization-spaces__card"
        :interactive="false"
        :title="root.name"
      >
        <template #icon>
          <span class="organization-spaces__icon"><AIcon type="HomeOutlined" /></span>
        </template>
        <template #badges>
          <a-tag color="green">{{ t(k + 'associated') }}</a-tag>
        </template>
        <template #subtitle>{{ t(k + 'spaceStructureReadonly') }}</template>
        <template #action>
          <div class="organization-spaces__actions">
            <a-button
              type="link"
              @click="preview(root)"
            >
              {{ t(k + 'viewSpaceTree') }}
            </a-button>
            <a-popconfirm
              :title="t(k + 'unbindConfirm')"
              @confirm="save(root, true)"
            >
              <j-permission-button
                hasPermission="charging/OrganizationType:bind"
                type="link"
                danger
                :disabled="disabled || saving || loading || failed"
              >
                {{ t(k + 'unbind') }}
              </j-permission-button>
            </a-popconfirm>
          </div>
        </template>
      </EntityCard>
      <CloudEmpty
        v-if="!bound.length && !loading && !failed"
        :description="
          t(
            k +
              (organizationType === 'external'
                ? 'unsupportedOrganizationType'
                : organizationType === 'project'
                ? 'noBoundSpaces'
                : 'projectTypeRequired')
          )
        "
      />
    </a-spin>
  </section>
  <a-modal
    :open="editing"
    :width="520"
    :style="{ maxWidth: 'calc(100vw - 32px)' }"
    :title="t(k + 'associateSpace')"
    :confirm-loading="saving"
    :ok-text="t(k + 'associateSpace')"
    :cancel-text="t(k + 'cancel')"
    :ok-button-props="{ disabled: !canBind || !selected }"
    :closable="!saving"
    :mask-closable="!saving"
    :keyboard="!saving"
    :cancel-button-props="{ disabled: saving }"
    @cancel="editing = false"
    @ok="bind"
  >
    <a-select
      v-model:value="selected"
      :options="options"
      :loading="loading"
      :disabled="!canBind"
      show-search
      option-filter-prop="label"
      :placeholder="t(k + 'selectRoot')"
      :aria-label="t(k + 'selectRoot')"
      style="width: 100%"
    />
  </a-modal>
  <a-drawer
    :open="previewOpen"
    :title="t(k + 'viewSpaceTree')"
    :width="520"
    :content-wrapper-style="{ maxWidth: '100vw' }"
    @close="previewOpen = false"
  >
    <a-spin :spinning="treeLoading">
      <a-tree
        v-if="tree.length"
        :tree-data="treeData"
        default-expand-all
        :selectable="false"
      />
      <CloudEmpty
        v-else-if="!treeLoading"
        :description="t(k + 'noSpaces')"
      />
    </a-spin>
  </a-drawer>
</template>

<style scoped src="./OrganizationSpaces.css"></style>
