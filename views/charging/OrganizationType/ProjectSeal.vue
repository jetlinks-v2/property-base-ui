<script setup lang="ts">
import { toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PropertyOrganization } from '../../../api/organization'
import { useProjectSeal } from '../../../hooks/useProjectSeal'

const props = defineProps<{ organization: PropertyOrganization; disabled: boolean }>()
const emit = defineEmits<{
  saved: [organization: PropertyOrganization]
  stale: []
  busy: [value: boolean]
}>()
const { t } = useI18n()
const { busy, isProject, imageFailed, imageUrl, canMaintain, persist } = useProjectSeal(
  toRef(props, 'organization'),
  (value) => emit('saved', value),
  () => emit('stale')
)
watch(busy, (value) => emit('busy', value))
const upload = (file: File) => {
  if (!props.disabled) void persist(file)
  return false
}
</script>

<template>
  <section
    v-if="isProject"
    class="project-seal"
  >
    <h3>{{ t('ProjectSeal.title') }}</h3>
    <div class="project-seal__body">
      <a-spin :spinning="busy">
        <div class="project-seal__preview">
          <a-image
            v-if="imageUrl && !imageFailed"
            :src="imageUrl"
            :alt="t('ProjectSeal.title')"
            :width="128"
            :height="128"
            style="object-fit: contain"
            @error="imageFailed = true"
          />
          <span
            v-else
            class="project-seal__empty"
          >
            <AIcon :type="imageFailed ? 'PictureOutlined' : 'FileImageOutlined'" />
            {{ t(imageFailed ? 'ProjectSeal.imageFailed' : 'ProjectSeal.empty') }}
          </span>
        </div>
      </a-spin>
      <div class="project-seal__controls">
        <a-space>
          <a-upload
            v-if="canMaintain || busy"
            accept="image/png,image/jpeg"
            :show-upload-list="false"
            :before-upload="upload"
            :disabled="disabled || busy"
          >
            <j-permission-button
              hasPermission="charging/OrganizationType:seal"
              :disabled="disabled || busy"
              :loading="busy"
            >
              <template #icon><AIcon type="UploadOutlined" /></template>
              {{ t(imageUrl ? 'ProjectSeal.replace' : 'ProjectSeal.upload') }}
            </j-permission-button>
          </a-upload>
          <a-popconfirm
            v-if="imageUrl && canMaintain"
            :title="t('ProjectSeal.removeConfirm')"
            :disabled="disabled || busy"
            @confirm="!disabled && persist(null)"
          >
            <j-permission-button
              hasPermission="charging/OrganizationType:seal"
              danger
              :disabled="disabled || busy"
            >
              {{ t('ProjectSeal.remove') }}
            </j-permission-button>
          </a-popconfirm>
        </a-space>
        <p>{{ t('ProjectSeal.hint') }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.project-seal {
  padding-block: var(--space-6, 1.5rem);
  border-bottom: 1px solid var(--line, #eee);
}
h3 {
  margin: 0 0 var(--space-4, 1rem);
  font-size: var(--fs-15, 0.9375rem);
}
.project-seal__body {
  display: flex;
  gap: var(--space-5, 1.25rem);
  align-items: center;
  flex-wrap: wrap;
}
.project-seal__preview {
  width: 8rem;
  height: 8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--line-strong, #d9d9d9);
  border-radius: var(--r-2, 0.5rem);
  background: var(--panel-background, #fff);
}
.project-seal__empty {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
  text-align: center;
  color: var(--ink-4, #8c8c8c);
}
.project-seal__empty :deep(.anticon) {
  font-size: var(--fs-24, 1.5rem);
}
.project-seal__controls p {
  margin: var(--space-3, 0.75rem) 0 0;
  color: var(--ink-4, #8c8c8c);
  font-size: var(--fs-12, 0.75rem);
}
</style>
