// =====================================================================
//  Types & Interfaces สำหรับระบบจองคิวแพทย์แผนไทย - Manager Portal
// =====================================================================

// --- ผู้ใช้ที่เข้าสู่ระบบ (ตาราง profiles) ---
export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: string
  username: string
  can_access_personalworkschedule: boolean
  can_access_workschedule: boolean
  can_access_bookingportalmanager: boolean
}

// --- ข้อมูลผู้ป่วย ---
export interface Patient {
  patient_id: string
  first_name: string
  last_name: string
  phone_number: string
  can_self_book: boolean
}

// --- ข้อมูลการจอง ---
export interface Booking {
  booking_id: string
  booking_date: string
  booking_time: string
  therapist_name: string
  patient_id: string
  patient_first_name: string
  patient_last_name: string
  patient_phone: string
  created_at?: string
  status?: string
}

// --- ข้อมูลการจองสำหรับ process ---
export interface BookingInfo {
  date: string
  time: string
  therapist: string
  patientId: string
  patientFirstName: string
  patientLastName: string
  patientPhone: string
  bookingId?: string
}

// --- ตัวกรองปฏิทิน ---
export interface Filters {
  people?: string
  therapist?: string
  timeSlot?: string
}

// --- ตัวเลือก Filter (โหลดจาก schedule_versions) ---
export interface FilterOptions {
  therapists: string[]
  timeSlots: string[]
  maxPeople: number
  therapistTimeMap: Record<string, string[]>
}

// --- สถานะวันในปฏิทิน ---
export type CalendarDayStatus = 'AVAILABLE' | 'FULL' | 'DISABLED'

// --- ข้อมูลปฏิทิน ---
export type CalendarData = Record<string, CalendarDayStatus>

// --- ผลลัพธ์จาก getCalendarData ---
export type CalendarResponseStatus = 'FOUND_IN_CURRENT' | 'FOUND_IN_FUTURE' | 'NOT_FOUND'

export interface CalendarResponse {
  status: CalendarResponseStatus
  data: CalendarData
  newMonth: number
  newYear: number
}

// --- ความพร้อมใช้งานของ slot ---
export type SlotAvailabilityStatus = 'AVAILABLE' | 'FULL' | 'NOT_AVAILABLE'

// --- ข้อมูล slot แต่ละช่วงเวลา ---
export interface SlotInfo {
  time: string
  availability: Record<string, SlotAvailabilityStatus>
}

// --- ข้อมูลรวม slots ---
export interface SlotsData {
  therapists: string[]
  slots: SlotInfo[]
}

// --- สถิติ Dashboard ---
export interface DashboardStats {
  totalBookings: number
  monthlyBookings: number
}

// --- ผลลัพธ์มาตรฐานจาก API ---
export interface ApiResult<T> {
  data: T | null
  error: Error | null
}

// --- ชื่อ View ทั้งหมดในแอป ---
export type AppView =
  | 'loading'
  | 'login'
  | 'dashboard'
  | 'booking-start'
  | 'calendar'
  | 'slots'
  | 'booking-form'
  | 'cancellation-search'
  | 'new-patient'
  | 'edit-patient'
