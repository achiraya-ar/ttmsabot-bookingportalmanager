<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Swal from 'sweetalert2'
import { useAppStore } from '@/stores/appStore'
import { getAvailableSlots } from '@/services/api'
import { formatThaiDate } from '@/utils/dateUtils'
import type { SlotsData } from '@/types'

const store = useAppStore()

const isLoading = ref(true)
const slotsData = ref<SlotsData>({ therapists: [], slots: [] })

onMounted(async () => {
  if (!store.selectedDate) {
    store.navigateTo('calendar')
    return
  }

  isLoading.value = true
  try {
    const { data, error } = await getAvailableSlots(
      store.selectedDate,
      true,
      {
        therapist: store.currentFilters.therapist,
        timeSlot: store.currentFilters.timeSlot,
      },
    )
    if (error) throw error
    if (data) slotsData.value = data
  } catch (err) {
    const e = err as Error
    Swal.fire('เกิดข้อผิดพลาด', `ระบบขัดข้อง: ${e.message || ''}`, 'error')
    store.navigateTo('calendar')
  } finally {
    isLoading.value = false
  }
})

function goBackToCalendar() {
  store.navigateTo('calendar')
}

function selectSlot(time: string, therapist: string) {
  store.selectSlot(store.selectedDate, time, therapist)
}
</script>

<template>
  <div id="slots-view">
    <!-- Page Title -->
    <h2 class="page-title">
      <i class="fa-solid fa-clock"></i>เลือกช่วงเวลานัดหมาย
    </h2>

    <!-- Booking Summary: selected date + patient -->
    <div class="booking-summary">
      <p class="summary-item">
        <i class="fa-solid fa-calendar-day"></i>
        <strong>วันที่เลือก:</strong> {{ formatThaiDate(store.selectedDate) }}
      </p>
      <template v-if="store.currentPatientData">
        <p class="summary-item">
          <template v-if="store.currentPatientData.first_name">
            <i class="fa-solid fa-user-check"></i>
            <strong>ผู้จอง:</strong>
            {{ store.currentPatientData.first_name }} {{ store.currentPatientData.last_name }}
          </template>
          <template v-else>
            <i class="fa-solid fa-user-plus"></i>
            <strong>กำลังจองสำหรับผู้ป่วยใหม่ ID:</strong>
            {{ store.currentPatientData.patient_id }}
          </template>
        </p>
      </template>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i>
      <p>กำลังโหลดช่วงเวลาว่าง...</p>
    </div>

    <!-- No slots available -->
    <div
      v-else-if="!isLoading && slotsData.slots.length === 0"
      class="booking-summary"
      style="border-left-color: var(--status-yellow); text-align: center"
    >
      <p class="summary-item">
        <i class="fa-solid fa-circle-info"></i>
        ไม่พบช่วงเวลาว่างสำหรับวันที่เลือก กรุณาเลือกวันอื่น
      </p>
    </div>

    <!-- Slots Table -->
    <template v-else>
      <table class="slots-table">
        <thead>
          <tr>
            <th>เวลา</th>
            <th
              v-for="therapist in slotsData.therapists"
              :key="therapist"
            >
              {{ therapist }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="slot in slotsData.slots" :key="slot.time">
            <td data-label="เวลา">
              <strong>{{ slot.time }} น.</strong>
            </td>
            <td
              v-for="therapist in slotsData.therapists"
              :key="therapist"
              :data-label="therapist"
            >
              <!-- Available -->
              <button
                v-if="slot.availability[therapist] === 'AVAILABLE'"
                class="btn btn-book btn-slot"
                @click="selectSlot(slot.time, therapist)"
              >
                <i class="fa-solid fa-calendar-check"></i> จอง
              </button>

              <!-- Full -->
              <button
                v-else-if="slot.availability[therapist] === 'FULL'"
                class="btn btn-full btn-slot"
                disabled
              >
                <i class="fa-solid fa-ban"></i> เต็ม
              </button>

              <!-- Not available (no schedule for this therapist at this time) -->
              <span
                v-else
                style="color: var(--status-disabled-text); font-size: 0.85em"
              >
                —
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- Back Button -->
    <div class="btn-action-group">
      <button id="back-to-calendar" class="btn btn-secondary" @click="goBackToCalendar">
        <i class="fa-solid fa-arrow-left"></i> กลับปฏิทิน
      </button>
    </div>
  </div>
</template>
