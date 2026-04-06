<script setup lang="ts">
import { ref } from 'vue'
import Swal from 'sweetalert2'
import { useAppStore } from '@/stores/appStore'
import { findMyBookings, cancelBooking } from '@/services/api'
import { formatThaiDate } from '@/utils/dateUtils'
import { createPrintSlip, createPrintAllSlip } from '@/utils/printUtils'
import { validateThaiId } from '@/utils/validators'
import type { Booking } from '@/types'

const store = useAppStore()

const searchId = ref('')
const isSearching = ref(false)
const hasSearched = ref(false)
const bookings = ref<Booking[]>([])

async function handleSearch(event: Event) {
  event.preventDefault()

  if (!validateThaiId(searchId.value)) {
    Swal.fire('ข้อมูลไม่ถูกต้อง', 'รูปแบบเลขบัตรประชาชนไม่ถูกต้อง', 'error')
    return
  }

  isSearching.value = true
  hasSearched.value = false
  bookings.value = []

  try {
    const { data, error } = await findMyBookings(searchId.value)
    if (error) throw error
    bookings.value = data ?? []
    hasSearched.value = true
  } catch (err) {
    const e = err as Error
    Swal.fire('เกิดข้อผิดพลาด', `ระบบขัดข้อง: ${e.message || ''}`, 'error')
  } finally {
    isSearching.value = false
  }
}

async function handleCancel(booking: Booking) {
  const detailsHtml = `
    <div style="text-align: left; padding: 0 1rem; font-size: 1rem;">
      <p><strong>ผู้จอง:</strong> ${booking.patient_first_name} ${booking.patient_last_name}</p>
      <hr>
      <p><strong>วันที่:</strong> ${formatThaiDate(booking.booking_date, true)}</p>
      <p><strong>เวลา:</strong> ${booking.booking_time.slice(0, 5)} น.</p>
      <p><strong>ชื่อหมอ:</strong> ${booking.therapist_name}</p>
    </div>
    <br>
    <p>คุณต้องการยกเลิกนัดหมายนี้ใช่หรือไม่?</p>
  `

  const result = await Swal.fire({
    title: 'ยืนยันการยกเลิกนัดหมาย?',
    html: detailsHtml,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันยกเลิก',
    cancelButtonText: 'ปิด',
    confirmButtonColor: 'var(--status-red)',
  })

  if (!result.isConfirmed) return

  Swal.fire({
    title: 'กำลังยกเลิกนัดหมาย...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  })

  try {
    const { data: res, error } = await cancelBooking(booking)
    if (error) throw error

    if (res && res.success) {
      await Swal.fire('สำเร็จ', 'ยกเลิกนัดหมายเรียบร้อยแล้ว', 'success')
      // Re-search to refresh the list
      const { data, error: fetchErr } = await findMyBookings(searchId.value)
      if (!fetchErr) bookings.value = data ?? []
    } else {
      Swal.fire('เกิดข้อผิดพลาด', res?.message || 'ไม่สามารถยกเลิกได้', 'error')
    }
  } catch (err) {
    const e = err as Error
    Swal.fire('เกิดข้อผิดพลาด', `ระบบขัดข้อง: ${e.message || ''}`, 'error')
  }
}
</script>

<template>
  <div id="cancellation-search-view">
    <!-- Page Title -->
    <h2 class="page-title">
      <i class="fa-solid fa-magnifying-glass"></i>ตรวจสอบ/ยกเลิกการจอง
    </h2>

    <!-- Search Form -->
    <form
      id="cancellation-search-form"
      novalidate
      style="max-width: 600px; margin: 0 auto 2rem auto; text-align: center"
      @submit="handleSearch"
    >
      <div class="form-group" style="text-align: left; margin-bottom: 1rem">
        <label for="searchPatientId">กรุณากรอกเลขบัตรประชาชน 13 หลักของผู้ป่วย</label>
        <input
          id="searchPatientId"
          v-model="searchId"
          type="tel"
          required
          pattern="[0-9]{13}"
          inputmode="numeric"
          placeholder="xxxxxxxxxxxxx"
          maxlength="13"
          :disabled="isSearching"
          style="text-align: center; font-size: 1.2rem; letter-spacing: 2px; background-color: var(--background-secondary); color: var(--dark-text)"
        />
      </div>

      <div class="btn-action-group">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="isSearching"
          @click="store.backToDashboard()"
        >
          <i class="fa-solid fa-home"></i> กลับหน้าหลัก
        </button>
        <button type="submit" class="btn" :disabled="isSearching">
          <i v-if="isSearching" class="fas fa-spinner fa-spin"></i>
          <i v-else class="fa-solid fa-magnifying-glass"></i>
          {{ isSearching ? 'กำลังค้นหา...' : 'ค้นหา' }}
        </button>
      </div>
    </form>

    <!-- Results Section -->
    <div id="cancellation-results">
      <!-- No results found -->
      <div
        v-if="hasSearched && bookings.length === 0"
        class="booking-summary"
        style="border-left-color: var(--status-yellow); text-align: center"
      >
        <p class="summary-item">
          <i class="fa-solid fa-circle-info"></i>
          ไม่พบรายการนัดหมายล่วงหน้าสำหรับเลขบัตรประชาชนนี้
        </p>
      </div>

      <!-- Booking list -->
      <template v-if="hasSearched && bookings.length > 0">
        <h3 style="color: var(--primary-accent); text-align: left">
          รายการนัดหมายของ: {{ bookings[0].patient_first_name }}
          {{ bookings[0].patient_last_name }} ({{ bookings.length }} รายการ)
        </h3>

        <!-- Print All Button -->
        <div class="print-all-container">
          <button class="btn" @click="createPrintAllSlip(bookings)">
            <i class="fa-solid fa-print"></i> พิมพ์ทั้งหมด
          </button>
        </div>

        <!-- Bookings Table -->
        <div class="slots-table-container">
          <table class="slots-table">
            <thead>
              <tr>
                <th>วันที่นัด</th>
                <th>เวลา</th>
                <th>ชื่อหมอ</th>
                <th style="min-width: 180px">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="booking in bookings" :key="booking.booking_id">
                <td data-label="วันที่นัด">
                  {{ formatThaiDate(booking.booking_date, false) }}
                </td>
                <td data-label="เวลา">{{ booking.booking_time.slice(0, 5) }} น.</td>
                <td data-label="ชื่อหมอ">{{ booking.therapist_name }}</td>
                <td data-label="ดำเนินการ" style="display: flex; gap: 0.5rem; flex-wrap: wrap">
                  <button
                    class="btn btn-slot"
                    style="background-color: var(--secondary-accent)"
                    @click="createPrintSlip(booking)"
                  >
                    <i class="fa-solid fa-print"></i> พิมพ์
                  </button>
                  <button
                    class="btn btn-slot"
                    style="background-color: var(--status-red)"
                    @click="handleCancel(booking)"
                  >
                    <i class="fa-solid fa-trash-can"></i> ยกเลิก
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>
