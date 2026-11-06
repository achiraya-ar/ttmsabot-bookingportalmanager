<script setup lang="ts">
import { ref } from 'vue'
import Swal from 'sweetalert2'
import { useAppStore } from '@/stores/appStore'
import { loginWithUsername } from '@/services/auth'

const store = useAppStore()
const username = ref('')
const password = ref('')
const isLoading = ref(false)

async function handleLogin(event: Event) {
  event.preventDefault()
  if (!username.value.trim() || !password.value) {
    Swal.fire('ผิดพลาด', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 'warning')
    return
  }

  isLoading.value = true
  try {
    const profile = await loginWithUsername(username.value, password.value)
    store.login(profile)

    await Swal.fire({
      icon: 'success',
      title: 'สำเร็จ!',
      text: `ยินดีต้อนรับ ${profile.full_name}`,
      timer: 1500,
      showConfirmButton: false,
    })
    store.navigateTo('dashboard')
  } catch (err) {
    const e = err as Error
    await Swal.fire('เข้าสู่ระบบไม่สำเร็จ', e.message || 'เกิดข้อผิดพลาด', 'error')
    password.value = ''
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div id="manager-login-view" class="form-container" style="margin: 3rem auto; max-width: 500px;">
    <h2 class="page-title" style="justify-content: center;">
      <i class="fa-solid fa-lock"></i> สำหรับผู้จัดการ
    </h2>

    <form id="manager-login-form" novalidate @submit="handleLogin">
      <div class="form-group">
        <label for="usernameInput">ชื่อผู้ใช้</label>
        <input
          id="usernameInput"
          v-model="username"
          type="text"
          required
          autocomplete="username"
          autocapitalize="none"
          placeholder="กรอกชื่อผู้ใช้"
          :disabled="isLoading"
        />
      </div>

      <div class="form-group" style="margin-top: 1rem;">
        <label for="passwordInput">รหัสผ่าน</label>
        <input
          id="passwordInput"
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
          placeholder="กรอกรหัสผ่าน"
          :disabled="isLoading"
        />
      </div>

      <div class="login-button-container">
        <button type="submit" class="btn" :disabled="isLoading">
          <i v-if="isLoading" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fa-solid fa-arrow-right-to-bracket"></i>
          {{ isLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ' }}
        </button>
      </div>
    </form>
  </div>
</template>
