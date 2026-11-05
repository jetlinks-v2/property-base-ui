<script setup lang="ts">
import ArchiveWorkspace from '../components/ArchiveWorkspace.vue'
import CustomerList from './CustomerList.vue'
</script>
<template>
  <ArchiveWorkspace>
    <template #default="{ scope, space, projectName }">
      <CustomerList
        :key="scope.projectId + ':' + (scope.spaceId || '')"
        :project-name="projectName"
        :scope="scope"
        :space="space"
      />
    </template>
  </ArchiveWorkspace>
</template>
