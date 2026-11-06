<script setup lang="ts">
defineProps<{
  isManagerLoggedIn: boolean
  userName?: string | null
}>()
</script>

<template>
  <header class="app-header">
    <div v-if="isManagerLoggedIn" id="manager-mode-indicator">
      <i class="fa-solid fa-user-shield"></i> โหมดผู้จัดการ
      <span v-if="userName"> · {{ userName }}</span>
    </div>
    <h1>
      <i class="fa-solid fa-spa icon-header"></i>
      กลุ่มงานการแพทย์แผนไทย โรงพยาบาลสระโบสถ์
    </h1>
    <p>ระบบนัดหมายเข้ารับบริการ (สำหรับเจ้าหน้าที่)</p>
  </header>
</template>
