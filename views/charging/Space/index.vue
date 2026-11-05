<script setup lang="ts">
import ArchiveWorkspace from '../components/ArchiveWorkspace.vue'
import HouseList from './HouseList.vue'
</script>
<template>
  <ArchiveWorkspace>
    <template #default="{ scope, space, projectName }">
      <HouseList
        :key="scope.projectId + ':' + (scope.spaceId || '')"
        :project-name="projectName"
        :scope="scope"
        :space="space"
      />
    </template>
  </ArchiveWorkspace>
</template>
