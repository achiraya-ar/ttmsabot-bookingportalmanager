<script setup lang="ts">
import { ref } from 'vue'
import Swal from 'sweetalert2'
import { useAppStore } from '@/stores/appStore'
import { checkPatientRegistration, registerNewPatient } from '@/services/api'
import { validateThaiId } from '@/utils/validators'
import SelfBookToggle from '@/components/SelfBookToggle.vue'

const store = useAppStore()

const patientId = ref('')
const patientFirstName = ref('')
const patientLastName = ref('')
const patientPhone = ref('')
const canSelfBook = ref(false)
const isSubmitting = ref(false)

async function handleSubmit(event: Event) {
  event.preventDefault()

  if (!validateThaiId(patientId.value)) {
    Swal.fire('ข้อมูลไม่ถูกต้อง', 'รูปแบบเลขบัตรประชาชนไม่ถูกต้อง', 'error')
    return
  }

  if (!patientFirstName.value.trim() || !patientLastName.value.trim() || !patientPhone.value.trim()) {
    Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลให้ครบทุกช่อง', 'warning')
    return
  }

  // ตรวจสอบว่ามีในระบบแล้วหรือไม่
  const { data: existing } = await checkPatientRegistration(patientId.value)
  if (existing) {
    Swal.fire('ข้อมูลซ้ำซ้อน', 'เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว ไม่สามารถลงทะเบียนซ้ำได้', 'error')
    return
  }

  const result = await Swal.fire({
    title: 'ยืนยันข้อมูลผู้ป่วยใหม่?',
    icon: 'question',
    html: `
      <div style="text-align: left; padding: 0 1rem;">
        <p><strong>เลขบัตร:</strong> ${patientId.value}</p>
        <p><strong>ชื่อ-สกุล:</strong> ${patientFirstName.value} ${patientLastName.value}</p>
        <p><strong>เบอร์โทร:</strong> ${patientPhone.value}</p>
        <p><strong>จองคิวเองผ่านหน้าเว็บ:</strong> ${canSelfBook.value ? 'อนุญาต' : 'ไม่อนุญาต'}</p>
      </div>
      <br>
      <p>ข้อมูลถูกต้องและต้องการบันทึกใช่หรือไม่?</p>
    `,
    showCancelButton: true,
    confirmButtonText: 'ยืนยันและบันทึก',
    cancelButtonText: 'แก้ไข',
  })

  if (!result.isConfirmed) return

  isSubmitting.value = true
  Swal.fire({
    title: 'กำลังบันทึกข้อมูล',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  })

  try {
    const { error } = await registerNewPatient({
      patient_id: patientId.value,
      first_name: patientFirstName.value.trim(),
      last_name: patientLastName.value.trim(),
      phone_number: patientPhone.value.trim(),
      can_self_book: canSelfBook.value,
    })

    if (error) throw error

    await Swal.fire('สำเร็จ!', 'ลงทะเบียนผู้ป่วยใหม่เรียบร้อยแล้ว', 'success')
    store.backToDashboard()
  } catch (err) {
    const e = err as Error
    Swal.fire('เกิดข้อผิดพลาด', `ระบบขัดข้อง: ${e.message || ''}`, 'error')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div id="new-patient-view">
    <h2 class="page-title">
      <i class="fa-solid fa-user-plus"></i>ลงทะเบียนผู้ป่วยใหม่
    </h2>

    <div class="form-container">
      <form id="new-patient-form" novalidate @submit="handleSubmit">
        <!-- Patient ID -->
        <div class="form-group">
          <label for="patientId">เลขบัตรประชาชน (13 หลัก)</label>
          <input
            id="patientId"
            v-model="patientId"
            type="tel"
            required
            pattern="[0-9]{13}"
            inputmode="numeric"
            maxlength="13"
            placeholder="กรอกเลข 13 หลัก"
            :disabled="isSubmitting"
          />
        </div>

        <!-- First Name -->
        <div class="form-group">
          <label for="patientFirstName">ชื่อ</label>
          <input
            id="patientFirstName"
            v-model="patientFirstName"
            type="text"
            required
            placeholder="ชื่อจริง"
            :disabled="isSubmitting"
          />
        </div>

        <!-- Last Name -->
        <div class="form-group">
          <label for="patientLastName">นามสกุล</label>
          <input
            id="patientLastName"
            v-model="patientLastName"
            type="text"
            required
            placeholder="นามสกุล"
            :disabled="isSubmitting"
          />
        </div>

        <!-- Phone -->
        <div class="form-group">
          <label for="patientPhone">เบอร์โทรศัพท์</label>
          <input
            id="patientPhone"
            v-model="patientPhone"
            type="tel"
            required
            pattern="[0-9]{9,10}"
            inputmode="tel"
            maxlength="10"
            placeholder="0xxxxxxxxx"
            :disabled="isSubmitting"
          />
        </div>

        <!-- Self-booking permission -->
        <div class="form-group">
          <SelfBookToggle v-model="canSelfBook" :disabled="isSubmitting" />
        </div>

        <!-- Action Buttons -->
        <div class="btn-action-group">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="isSubmitting"
            @click="store.backToDashboard()"
          >
            <i class="fa-solid fa-arrow-left"></i> กลับ
          </button>
          <button type="submit" class="btn" :disabled="isSubmitting">
            <i v-if="isSubmitting" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fa-solid fa-save"></i>
            {{ isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
