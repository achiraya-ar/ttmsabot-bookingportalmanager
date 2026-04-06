<script setup lang="ts">
import { ref } from 'vue'
import Swal from 'sweetalert2'
import { useAppStore } from '@/stores/appStore'
import { getManagerPassword } from '@/services/api'

const store = useAppStore()
const password = ref('')
const isLoading = ref(false)

async function handleLogin(event: Event) {
  event.preventDefault()
  if (!password.value) {
    Swal.fire('ผิดพลาด', 'กรุณากรอกรหัสผ่าน', 'warning')
    return
  }

  isLoading.value = true
  try {
    const { data, error } = await getManagerPassword()
    if (error) throw error
    if (!data) throw new Error('ไม่พบการตั้งค่ารหัสผ่าน')

    if (password.value === data.setting_value) {
      store.login()
      await Swal.fire({
        icon: 'success',
        title: 'สำเร็จ!',
        text: 'เข้าสู่โหมดผู้จัดการแล้ว',
        timer: 1500,
        showConfirmButton: false,
      })
      store.navigateTo('dashboard')
    } else {
      await Swal.fire('ผิดพลาด', 'รหัสผ่านไม่ถูกต้อง', 'error')
      password.value = ''
    }
  } catch (err) {
    const e = err as Error
    Swal.fire('เกิดข้อผิดพลาด', `ระบบขัดข้อง: ${e.message || ''}`, 'error')
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
        <label for="passwordInput">กรุณากรอกรหัสผ่านเพื่อเข้าสู่ระบบ</label>
        <input
          id="passwordInput"
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
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
