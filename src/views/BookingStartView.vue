<script setup lang="ts">
import { ref } from 'vue'
import Swal from 'sweetalert2'
import { useAppStore } from '@/stores/appStore'
import { checkPatientRegistration } from '@/services/api'
import { validateThaiId } from '@/utils/validators'
import type { Patient } from '@/types'

const store = useAppStore()
const patientId = ref('')
const isLoading = ref(false)

async function handleSubmit(event: Event) {
  event.preventDefault()

  if (!validateThaiId(patientId.value)) {
    Swal.fire('ข้อมูลไม่ถูกต้อง', 'รูปแบบเลขบัตรประชาชนไม่ถูกต้อง', 'error')
    return
  }

  isLoading.value = true
  try {
    const { data: patient, error } = await checkPatientRegistration(patientId.value)

    if (error || !patient) {
      // ไม่พบผู้ป่วยในระบบ → ถามว่าจะดำเนินการต่อหรือไม่
      const result = await Swal.fire({
        title: 'ไม่พบผู้ป่วยในระบบ',
        html: `ไม่พบข้อมูลสำหรับเลขบัตรประชาชน: <strong>${patientId.value}</strong><br>คุณต้องการดำเนินการจองคิวต่อสำหรับผู้ป่วยรายนี้หรือไม่?`,
        icon: 'question',
        showDenyButton: true,
        confirmButtonText: '<i class="fa-solid fa-calendar-plus"></i> ดำเนินการจองต่อ',
        denyButtonText: 'กลับหน้าหลัก',
      })

      if (result.isConfirmed) {
        // จองโดยไม่มีข้อมูลผู้ป่วยในระบบ (จะกรอกในฟอร์มจอง)
        const newPatient: Patient = {
          patient_id: patientId.value,
          first_name: '',
          last_name: '',
          phone_number: '',
        }
        store.startBookingFlow(newPatient)
      } else {
        store.backToDashboard()
      }
    } else {
      // พบผู้ป่วยในระบบ
      await Swal.fire({
        icon: 'success',
        title: 'พบข้อมูลผู้ป่วย!',
        html: `กำลังไปที่หน้าจองคิวสำหรับคุณ <strong>${patient.first_name} ${patient.last_name}</strong>`,
        timer: 2000,
        showConfirmButton: false,
      })
      store.startBookingFlow(patient)
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
  <div id="pre-check-view">
    <h2 class="page-title">
      <i class="fa-solid fa-id-card"></i>ค้นหาผู้ป่วยเพื่อทำการจอง
    </h2>
    <p>กรุณากรอกเลขบัตรประชาชนของผู้ป่วยที่ต้องการจองคิว</p>

    <form id="pre-check-form" novalidate @submit="handleSubmit">
      <div class="form-group">
        <label for="checkPatientId">เลขบัตรประชาชน</label>
        <input
          id="checkPatientId"
          v-model="patientId"
          type="tel"
          required
          pattern="[0-9]{13}"
          inputmode="numeric"
          placeholder="xxxxxxxxxxxxx"
          maxlength="13"
          :disabled="isLoading"
        />
      </div>

      <div class="btn-action-group">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="isLoading"
          @click="store.backToDashboard()"
        >
          <i class="fa-solid fa-home"></i> กลับหน้าหลัก
        </button>
        <button type="submit" class="btn" :disabled="isLoading">
          <i v-if="isLoading" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fa-solid fa-search"></i>
          {{ isLoading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ' }}
        </button>
      </div>
    </form>
  </div>
</template>
