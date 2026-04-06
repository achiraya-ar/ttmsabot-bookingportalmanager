<template>
  <div class="loading-spinner">
    <i class="fas fa-spinner fa-spin"></i>
    <p>{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    message?: string
  }>(),
  {
    message: 'กำลังโหลดข้อมูล...',
  },
)
</script>
