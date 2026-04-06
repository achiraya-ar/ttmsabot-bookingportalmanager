<script setup lang="ts">
import { ref } from 'vue'
import Swal from 'sweetalert2'
import { useAppStore } from '@/stores/appStore'
import { checkPatientRegistration, updatePatientData, deletePatientData } from '@/services/api'
import { validateThaiId } from '@/utils/validators'
import type { Patient } from '@/types'

const store = useAppStore()

const searchId = ref('')
const isSearching = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const foundPatient = ref<Patient | null>(null)
const searchError = ref(false)

// Edit form fields
const editFirstName = ref('')
const editLastName = ref('')
const editPhone = ref('')

async function handleSearch(event: Event) {
  event.preventDefault()

  if (!validateThaiId(searchId.value)) {
    Swal.fire('ข้อมูลไม่ถูกต้อง', 'รูปแบบเลขบัตรประชาชนไม่ถูกต้อง', 'error')
    return
  }

  isSearching.value = true
  foundPatient.value = null
  searchError.value = false

  try {
    const { data: patient, error } = await checkPatientRegistration(searchId.value)

    if (error || !patient) {
      searchError.value = true
      foundPatient.value = null
    } else {
      foundPatient.value = patient
      editFirstName.value = patient.first_name
      editLastName.value = patient.last_name
      editPhone.value = patient.phone_number || ''
    }
  } catch (err) {
    const e = err as Error
    Swal.fire('เกิดข้อผิดพลาด', `ระบบขัดข้อง: ${e.message || ''}`, 'error')
  } finally {
    isSearching.value = false
  }
}

async function handleUpdate(event: Event) {
  event.preventDefault()

  if (!foundPatient.value) return

  if (!editFirstName.value.trim() || !editLastName.value.trim() || !editPhone.value.trim()) {
    Swal.fire('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลให้ครบทุกช่อง', 'warning')
    return
  }

  const result = await Swal.fire({
    title: 'ยืนยันการแก้ไขข้อมูล?',
    html: `คุณต้องการบันทึกการเปลี่ยนแปลงสำหรับผู้ป่วย ID: <strong>${foundPatient.value.patient_id}</strong> ใช่หรือไม่?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
  })

  if (!result.isConfirmed) return

  isSaving.value = true
  Swal.fire({
    title: 'กำลังอัปเดตข้อมูล...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  })

  try {
    const { error } = await updatePatientData(foundPatient.value.patient_id, {
      first_name: editFirstName.value.trim(),
      last_name: editLastName.value.trim(),
      phone_number: editPhone.value.trim(),
    })

    if (error) throw error

    await Swal.fire('สำเร็จ', 'อัปเดตข้อมูลผู้ป่วยเรียบร้อยแล้ว', 'success')

    // Update local state
    foundPatient.value = {
      ...foundPatient.value,
      first_name: editFirstName.value.trim(),
      last_name: editLastName.value.trim(),
      phone_number: editPhone.value.trim(),
    }
  } catch (err) {
    const e = err as Error
    Swal.fire('เกิดข้อผิดพลาด', `ระบบขัดข้อง: ${e.message || ''}`, 'error')
  } finally {
    isSaving.value = false
  }
}

async function handleDelete() {
  if (!foundPatient.value) return

  const result = await Swal.fire({
    title: 'คุณแน่ใจหรือไม่?',
    html: `ต้องการลบข้อมูลของคุณ <strong>${foundPatient.value.first_name} ${foundPatient.value.last_name}</strong> ออกจากระบบทะเบียนใช่หรือไม่?<br><strong style="color:red;">การกระทำนี้ไม่สามารถย้อนกลับได้!</strong>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ใช่, ลบเลย',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: 'var(--status-red)',
  })

  if (!result.isConfirmed) return

  isDeleting.value = true
  Swal.fire({
    title: 'กำลังลบข้อมูล...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  })

  try {
    const { error } = await deletePatientData(foundPatient.value.patient_id)

    if (error) throw error

    await Swal.fire('สำเร็จ', 'ลบข้อมูลผู้ป่วยเรียบร้อยแล้ว', 'success')

    // Reset form
    foundPatient.value = null
    searchId.value = ''
    editFirstName.value = ''
    editLastName.value = ''
    editPhone.value = ''
    searchError.value = false
  } catch (err) {
    const e = err as Error
    Swal.fire('เกิดข้อผิดพลาด', `ระบบขัดข้อง: ${e.message || ''}`, 'error')
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div id="edit-patient-view">
    <!-- Page Title -->
    <h2 class="page-title">
      <i class="fa-solid fa-user-pen"></i>แก้ไขข้อมูลผู้ป่วย
    </h2>

    <div class="form-container">
      <!-- Search Form -->
      <form id="edit-patient-search-form" novalidate @submit="handleSearch">
        <div class="form-group">
          <label for="searchPatientId">ค้นหาด้วยเลขบัตรประชาชน</label>
          <input
            id="searchPatientId"
            v-model="searchId"
            type="tel"
            required
            pattern="[0-9]{13}"
            inputmode="numeric"
            placeholder="กรอกเลข 13 หลักแล้วกดค้นหา"
            maxlength="13"
            :disabled="isSearching"
          />
        </div>

        <div class="btn-action-group">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="isSearching"
            @click="store.backToDashboard()"
          >
            <i class="fa-solid fa-arrow-left"></i> กลับ
          </button>
          <button type="submit" class="btn" :disabled="isSearching">
            <i v-if="isSearching" class="fas fa-spinner fa-spin"></i>
            <i v-else class="fa-solid fa-magnifying-glass"></i>
            {{ isSearching ? 'กำลังค้นหา...' : 'ค้นหา' }}
          </button>
        </div>
      </form>

      <!-- Search Result Container -->
      <div id="edit-patient-result-container" style="margin-top: 2rem">
        <!-- Not Found -->
        <p
          v-if="searchError"
          style="color: var(--status-red); text-align: center"
        >
          <i class="fa-solid fa-circle-xmark"></i>
          ไม่พบข้อมูลผู้ป่วยสำหรับเลขบัตรประชาชนนี้
        </p>

        <!-- Edit Form (shown when patient is found) -->
        <div v-if="foundPatient" class="edit-patient-result">
          <h4 style="color: var(--primary-accent); margin-top: 0; margin-bottom: 1rem">
            <i class="fa-solid fa-circle-check" style="color: var(--status-green)"></i>
            ข้อมูลผู้ป่วยที่พบ
          </h4>

          <form id="edit-patient-form" novalidate @submit="handleUpdate">
            <!-- Patient ID (read-only) -->
            <div class="form-group">
              <label>เลขบัตรประชาชน</label>
              <input
                type="text"
                :value="foundPatient.patient_id"
                readonly
              />
            </div>

            <!-- First Name -->
            <div class="form-group">
              <label for="editFirstName">ชื่อ</label>
              <input
                id="editFirstName"
                v-model="editFirstName"
                type="text"
                required
                :disabled="isSaving || isDeleting"
              />
            </div>

            <!-- Last Name -->
            <div class="form-group">
              <label for="editLastName">นามสกุล</label>
              <input
                id="editLastName"
                v-model="editLastName"
                type="text"
                required
                :disabled="isSaving || isDeleting"
              />
            </div>

            <!-- Phone -->
            <div class="form-group">
              <label for="editPhone">เบอร์โทรศัพท์</label>
              <input
                id="editPhone"
                v-model="editPhone"
                type="tel"
                required
                pattern="[0-9]{9,10}"
                inputmode="tel"
                maxlength="10"
                :disabled="isSaving || isDeleting"
              />
            </div>

            <!-- Action Buttons -->
            <div class="btn-action-group" style="justify-content: space-between">
              <!-- Delete Button (left side) -->
              <button
                type="button"
                class="btn"
                style="background-color: var(--status-red)"
                :disabled="isSaving || isDeleting"
                @click="handleDelete"
              >
                <i v-if="isDeleting" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fa-solid fa-trash-can"></i>
                {{ isDeleting ? 'กำลังลบ...' : 'ลบข้อมูลผู้ป่วย' }}
              </button>

              <!-- Save Button (right side) -->
              <button
                id="btn-save-changes"
                type="submit"
                class="btn"
                :disabled="isSaving || isDeleting"
              >
                <i v-if="isSaving" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fa-solid fa-save"></i>
                {{ isSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
