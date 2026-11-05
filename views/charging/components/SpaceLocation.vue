<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineProps<{ space: { name: string; fullName?: string; spaceTypeName?: string; spaceLocation?: string } }>()
const { t } = useI18n()
</script>
<template>
  <div class="space-location">
    <span class="space-location__icon"><AIcon type="EnvironmentOutlined" /></span>
    <div>
      <span class="space-location__label">{{ t('Archive.spaceInformation') }}</span>
      <strong>
        {{ space.name }}
        <a-tag
          v-if="space.spaceTypeName"
          color="blue"
        >
          {{ space.spaceTypeName }}
        </a-tag>
      </strong>
      <p>{{ space.fullName || space.name }}</p>
    </div>
    <AIcon
      type="LockOutlined"
      class="space-location__lock"
    />
  </div>
</template>
<style scoped>
.space-location {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  margin-bottom: 24px;
  background: var(--ant-color-fill-quaternary, #f5f7fa);
  border-radius: 8px;
}
.space-location__icon {
  font-size: 22px;
  color: var(--ant-color-primary, #1677ff);
  padding-top: 2px;
}
.space-location > div {
  flex: 1;
  min-width: 0;
}
.space-location__label {
  font-size: 12px;
  color: var(--ant-color-text-secondary, #595959);
  display: block;
  margin-bottom: 8px;
}
.space-location strong {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 16px;
  font-weight: 600;
}
.space-location p {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.9;
  color: var(--ant-color-text-secondary, #595959);
  overflow-wrap: anywhere;
}
.space-location__lock {
  color: var(--ant-color-text-secondary, #595959);
  margin-top: 2px;
}
</style>
