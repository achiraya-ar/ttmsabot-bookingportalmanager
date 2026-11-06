<script setup lang="ts">
import { computed, ref } from 'vue'
import Swal from 'sweetalert2'
import { useAppStore } from '@/stores/appStore'
import { checkPatientRegistration } from '@/services/api'
import { formatThaiDate } from '@/utils/dateUtils'
import { validateThaiId } from '@/utils/validators'
import type { Patient } from '@/types'

const store = useAppStore()
const patientId = ref('')
const isLoading = ref(false)

const totalPeople = computed(() => {
  const parsed = parseInt(String(store.currentFilters?.people ?? '1'), 10)
  return isNaN(parsed) || parsed < 1 ? 1 : parsed
})

/** กำลังอยู่ในขั้นตอนระบุตัวตนของผู้เข้ารับบริการคนถัดไปหรือไม่ */
const isNextPersonMode = computed(
  () => store.awaitingNextPatient && totalPeople.value > 1,
)

/** ลำดับของผู้เข้ารับบริการคนที่กำลังจะจอง เช่น คนที่ 2 จาก 2 */
const personNumber = computed(() =>
  Math.max(1, totalPeople.value - store.remainingToBook + 1),
)

/** ข้อความแสดงไอดีหลักที่ใช้เริ่มการจองรอบนี้ */
const primaryPatientLabel = computed(() => {
  const patient = store.primaryPatient
  if (!patient) return ''
  const name = `${patient.first_name} ${patient.last_name}`.trim()
  return name ? `${name} (${patient.patient_id})` : patient.patient_id
})

function goToBooking(patient: Patient) {
  if (isNextPersonMode.value) {
    store.selectNextPatient(patient)
  } else {
    store.startBookingFlow(patient)
  }
}

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
        html: `ไม่พบข้อมูลสำหรับเลขบัตรประชาชน: <strong>${patientId.value}</strong><br>คุณต้องการดำเนินการจองคิวต่อสำหรับผู้ป่วยรายนี้หรือไม่?<br><small>ระบบจะสร้างทะเบียนผู้ป่วยใหม่ให้อัตโนมัติ โดยยังไม่เปิดให้ผู้ป่วยจองคิวเองผ่านหน้าเว็บ (สามารถเปิดได้ภายหลังในหน้าแก้ไขข้อมูลผู้ป่วย)</small>`,
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
          can_self_book: false,
        }
        goToBooking(newPatient)
      } else {
        store.backToDashboard()
      }
    } else {
      // พบผู้ป่วยในระบบ
      await Swal.fire({
        icon: 'success',
        title: 'พบข้อมูลผู้ป่วย!',
        html: `กำลังไปที่หน้าจองคิวสำหรับ <strong>${patient.first_name} ${patient.last_name}</strong>`,
        timer: 2000,
        showConfirmButton: false,
      })
      goToBooking(patient)
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
      <i class="fa-solid fa-id-card"></i>
      {{ isNextPersonMode ? 'เลือกผู้เข้ารับบริการคนถัดไป' : 'ค้นหาผู้ป่วยเพื่อทำการจอง' }}
    </h2>

    <div class="form-container">
      <p v-if="isNextPersonMode">
        กรอกเลขบัตรประชาชนของผู้เข้ารับบริการคนที่ {{ personNumber }} จาก {{ totalPeople }}
        (เหลืออีก {{ store.remainingToBook }} คน)
      </p>
      <p v-else>กรุณากรอกเลขบัตรประชาชนของผู้ป่วยที่ต้องการจองคิว</p>

      <div v-if="isNextPersonMode" class="booking-summary" style="text-align: left">
        <p v-if="primaryPatientLabel" class="summary-item">
          <i class="fa-solid fa-user-check"></i>
          <strong>ผู้รับบริการหลัก:</strong>
          {{ primaryPatientLabel }}
        </p>
        <p class="summary-item">
          <i class="fa-solid fa-users"></i>
          <strong>ผู้เข้ารับบริการ:</strong>
          คนที่ {{ personNumber }} จาก {{ totalPeople }}
        </p>
        <p v-if="store.selectedDate" class="summary-item">
          <i class="fa-solid fa-calendar-day"></i>
          <strong>วันที่เลือก:</strong>
          {{ formatThaiDate(store.selectedDate) }}
        </p>
        <p class="summary-item">
          <i class="fa-solid fa-clock"></i>
          <strong>ขั้นตอนถัดไป:</strong>
          เลือกช่วงเวลาและยืนยันการจองสำหรับคนนี้
        </p>
      </div>

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
            placeholder="กรอกเลขบัตรประชาชน 13 หลัก"
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
            {{
              isLoading
                ? 'กำลังตรวจสอบ...'
                : isNextPersonMode
                  ? 'เลือกคนถัดไป'
                  : 'ตรวจสอบ'
            }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
