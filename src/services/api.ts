// =====================================================================
//  API Service - ฟังก์ชันติดต่อ Supabase ทั้งหมด
//  Manager Portal v1.0 (Vite + Vue + TypeScript)
// =====================================================================

import { supabase } from '@/lib/supabase'
import { formatDateToYYYYMMDD } from '@/utils/dateUtils'
import type {
  Patient,
  Booking,
  BookingInfo,
  FilterOptions,
  CalendarResponse,
  CalendarData,
  SlotsData,
  DashboardStats,
  ApiResult,
} from '@/types'

// ─────────────────────────────────────────────────────────────────────
//  Auth
// ─────────────────────────────────────────────────────────────────────

export async function getManagerPassword(): Promise<ApiResult<{ setting_value: string }>> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_name', 'login_password')
      .single()
    if (error) throw error
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e as Error }
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Patient Management
// ─────────────────────────────────────────────────────────────────────

export async function checkPatientRegistration(patientId: string): Promise<ApiResult<Patient>> {
  try {
    const { data, error } = await supabase
      .from('bookings_register')
      .select('*')
      .eq('patient_id', patientId)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return { data: data ?? null, error: data ? null : (error as Error | null) }
  } catch (e) {
    return { data: null, error: e as Error }
  }
}

export async function registerNewPatient(patientData: Patient): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase.from('bookings_register').insert([patientData])
    if (error) throw error
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e as Error }
  }
}

export async function updatePatientData(
  patientId: string,
  updates: Partial<Omit<Patient, 'patient_id'>>,
): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase
      .from('bookings_register')
      .update(updates)
      .eq('patient_id', patientId)
    if (error) throw error
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e as Error }
  }
}

export async function deletePatientData(patientId: string): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase
      .from('bookings_register')
      .delete()
      .eq('patient_id', patientId)
    if (error) throw error
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e as Error }
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Filter Options
// ─────────────────────────────────────────────────────────────────────

export async function getFilterOptions(isManagerMode = true): Promise<ApiResult<FilterOptions>> {
  try {
    let query = supabase
      .from('schedules')
      .select('therapist_name, time_slots, visibility')

    if (!isManagerMode) {
      query = query.eq('visibility', 'public')
    }

    const { data: schedulesData, error } = await query
    if (error) throw error

    const uniqueTherapists = [
      ...new Set(schedulesData.map((row: { therapist_name: string }) => row.therapist_name.trim())),
    ].sort() as string[]

    const maxPeople = uniqueTherapists.length
    const allTimeSlots = new Set<string>()
    const therapistTimeMap: Record<string, string[]> = {}

    schedulesData.forEach((row: { therapist_name: string; time_slots: string[] }) => {
      if (row.time_slots && row.time_slots.length > 0) {
        const therapist = row.therapist_name.trim()
        if (!therapistTimeMap[therapist]) {
          therapistTimeMap[therapist] = []
        }
        row.time_slots.forEach((slot: string) => {
          const trimmedSlot = slot.trim()
          if (!therapistTimeMap[therapist].includes(trimmedSlot)) {
            therapistTimeMap[therapist].push(trimmedSlot)
          }
          allTimeSlots.add(trimmedSlot)
        })
      }
    })

    for (const therapist in therapistTimeMap) {
      therapistTimeMap[therapist] = therapistTimeMap[therapist].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      )
    }

    const sortedTimeSlots = Array.from(allTimeSlots).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    )

    return {
      data: {
        therapists: uniqueTherapists,
        timeSlots: sortedTimeSlots,
        maxPeople,
        therapistTimeMap,
      },
      error: null,
    }
  } catch (e) {
    return { data: null, error: e as Error }
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Calendar Data
// ─────────────────────────────────────────────────────────────────────

export async function getCalendarData(
  month: number,
  year: number,
  isManagerMode = true,
  filters: { people?: string; therapist?: string; timeSlot?: string } = {},
): Promise<ApiResult<CalendarResponse>> {
  async function _checkMonthAvailability(
    checkMonth: number,
    checkYear: number,
  ): Promise<{ calendarStatus: CalendarData; isAnyDayAvailable: boolean }> {
    const startDate = new Date(checkYear, checkMonth, 1)
    const endDate = new Date(checkYear, checkMonth + 1, 0)
    const firstDayOfMonth = formatDateToYYYYMMDD(startDate)
    const lastDayOfMonth = formatDateToYYYYMMDD(endDate)

    const [
      { data: holidaysData, error: e1 },
      { data: schedulesData, error: e2 },
      { data: bookingsData, error: e3 },
      { data: blockagesData, error: e4 },
    ] = await Promise.all([
      supabase
        .from('holidays')
        .select('holiday_date')
        .gte('holiday_date', firstDayOfMonth)
        .lte('holiday_date', lastDayOfMonth),
      supabase
        .from('schedules')
        .select('therapist_name, day_of_week, time_slots, visibility'),
      supabase
        .from('bookings')
        .select('booking_date, booking_time, therapist_name')
        .gte('booking_date', firstDayOfMonth)
        .lte('booking_date', lastDayOfMonth),
      supabase
        .from('blockages')
        .select('block_date, block_time, therapist_name')
        .gte('block_date', firstDayOfMonth)
        .lte('block_date', lastDayOfMonth),
    ])

    const fetchError = e1 || e2 || e3 || e4
    if (fetchError) throw fetchError

    const todayString = formatDateToYYYYMMDD(new Date())
    const maxBookingDate = new Date()
    maxBookingDate.setDate(maxBookingDate.getDate() + 30)
    const maxBookingDateString = formatDateToYYYYMMDD(maxBookingDate)

    const holidays = (holidaysData ?? []).map((h: { holiday_date: string }) => h.holiday_date)
    const peopleToFind = parseInt(filters.people || '1')
    const calendarStatus: CalendarData = {}
    let isAnyDayAvailable = false

    for (
      const d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateString = formatDateToYYYYMMDD(d)
      const dayOfWeek = d.getDay()

      if (
        dateString < todayString ||
        dateString > maxBookingDateString ||
        holidays.includes(dateString) ||
        dayOfWeek === 0 ||
        dayOfWeek === 6
      ) {
        calendarStatus[dateString] = 'DISABLED'
        continue
      }

      const todaysSchedules = (schedulesData ?? []).filter((s: {
        day_of_week: number
        visibility: string
        therapist_name: string
      }) => {
        if (s.day_of_week != dayOfWeek) return false
        if (!isManagerMode && s.visibility !== 'public') return false
        if (filters.therapist && s.therapist_name.trim() !== filters.therapist) return false
        return true
      })

      if (todaysSchedules.length < peopleToFind) {
        calendarStatus[dateString] = 'FULL'
        continue
      }

      const bookingsOnDate = (bookingsData ?? []).filter(
        (b: { booking_date: string }) => b.booking_date === dateString,
      )
      const blockagesOnDate = (blockagesData ?? []).filter(
        (bl: { block_date: string }) => bl.block_date === dateString,
      )

      const timeSlotsToday = new Set<string>()
      todaysSchedules.forEach((s: { time_slots: string[] }) => {
        if (s.time_slots) s.time_slots.forEach((slot: string) => timeSlotsToday.add(slot.trim()))
      })

      let isDayAvailable = false

      for (const time of Array.from(timeSlotsToday).sort((a, b) => a.localeCompare(b))) {
        if (filters.timeSlot && time !== filters.timeSlot) continue

        let availableTherapists = 0
        for (const schedule of todaysSchedules) {
          const therapistName = (schedule as { therapist_name: string }).therapist_name.trim()
          const scheduleSlots = (schedule as { time_slots: string[] }).time_slots

          if (scheduleSlots && scheduleSlots.includes(time)) {
            const isBooked = bookingsOnDate.some(
              (b: { booking_time: string; therapist_name: string }) =>
                b.booking_time.slice(0, 5) === time && b.therapist_name.trim() === therapistName,
            )
            const isBlocked = blockagesOnDate.some(
              (bl: { block_time: string; therapist_name: string }) =>
                bl.block_time.slice(0, 5) === time && bl.therapist_name.trim() === therapistName,
            )
            if (!isBooked && !isBlocked) availableTherapists++
          }
        }

        if (availableTherapists >= peopleToFind) {
          isDayAvailable = true
          break
        }
      }

      calendarStatus[dateString] = isDayAvailable ? 'AVAILABLE' : 'FULL'
      if (isDayAvailable) isAnyDayAvailable = true
    }

    return { calendarStatus, isAnyDayAvailable }
  }

  try {
    const initialCheck = await _checkMonthAvailability(month, year)

    if (initialCheck.isAnyDayAvailable) {
      return {
        data: {
          status: 'FOUND_IN_CURRENT',
          data: initialCheck.calendarStatus,
          newMonth: month,
          newYear: year,
        },
        error: null,
      }
    }

    for (let i = 1; i <= 6; i++) {
      const nextDate = new Date(year, month + i, 1)
      const futureCheck = await _checkMonthAvailability(
        nextDate.getMonth(),
        nextDate.getFullYear(),
      )
      if (futureCheck.isAnyDayAvailable) {
        return {
          data: {
            status: 'FOUND_IN_FUTURE',
            data: futureCheck.calendarStatus,
            newMonth: nextDate.getMonth(),
            newYear: nextDate.getFullYear(),
          },
          error: null,
        }
      }
    }

    return {
      data: {
        status: 'NOT_FOUND',
        data: initialCheck.calendarStatus,
        newMonth: month,
        newYear: year,
      },
      error: null,
    }
  } catch (e) {
    return { data: null, error: e as Error }
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Available Slots
// ─────────────────────────────────────────────────────────────────────

export async function getAvailableSlots(
  dateString: string,
  isManagerMode = true,
  filters: { therapist?: string; timeSlot?: string } = {},
): Promise<ApiResult<SlotsData>> {
  try {
    const dayOfWeek = new Date(dateString + 'T00:00:00').getDay()

    const [
      { data: bookingsOnDate, error: e1 },
      { data: blockedSlotsForDate, error: e2 },
      { data: allSchedules, error: e3 },
    ] = await Promise.all([
      supabase
        .from('bookings')
        .select('booking_time, therapist_name')
        .eq('booking_date', dateString),
      supabase
        .from('blockages')
        .select('block_time, therapist_name')
        .eq('block_date', dateString),
      supabase
        .from('schedules')
        .select('therapist_name, day_of_week, time_slots, visibility'),
    ])

    const fetchError = e1 || e2 || e3
    if (fetchError) throw fetchError

    const todaysSchedules = (allSchedules ?? []).filter((s: {
      day_of_week: number
      visibility: string
    }) => {
      if (s.day_of_week != dayOfWeek) return false
      if (!isManagerMode && s.visibility !== 'public') return false
      return true
    })

    if (todaysSchedules.length === 0) {
      return { data: { therapists: [], slots: [] }, error: null }
    }

    let therapistsToday = [
      ...new Set(
        todaysSchedules.map((s: { therapist_name: string }) => s.therapist_name.trim()),
      ),
    ].sort() as string[]

    if (filters.therapist) {
      therapistsToday = therapistsToday.filter((t) => t === filters.therapist)
    }

    const allSlotsToday = new Set<string>()
    todaysSchedules.forEach((s: { time_slots: string[] }) => {
      if (s.time_slots) s.time_slots.forEach((slot: string) => allSlotsToday.add(slot.trim()))
    })

    let sortedSlots = Array.from(allSlotsToday).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    )

    if (filters.timeSlot) {
      sortedSlots = sortedSlots.filter((t) => t === filters.timeSlot)
    }

    const slotsResult = sortedSlots.map((time) => {
      const slotInfo: { time: string; availability: Record<string, string> } = {
        time,
        availability: {},
      }

      therapistsToday.forEach((therapistName) => {
        const therapistSchedule = todaysSchedules.find(
          (s: { therapist_name: string }) => s.therapist_name.trim() === therapistName,
        )
        const hasSlot =
          therapistSchedule &&
          (therapistSchedule as { time_slots: string[] }).time_slots &&
          (therapistSchedule as { time_slots: string[] }).time_slots.includes(time)

        if (hasSlot) {
          const isBooked = (bookingsOnDate ?? []).some(
            (b: { booking_time: string; therapist_name: string }) =>
              b.booking_time.slice(0, 5) === time && b.therapist_name.trim() === therapistName,
          )
          const isBlocked = (blockedSlotsForDate ?? []).some(
            (bl: { block_time: string; therapist_name: string }) =>
              bl.block_time.slice(0, 5) === time && bl.therapist_name.trim() === therapistName,
          )
          slotInfo.availability[therapistName] = isBooked || isBlocked ? 'FULL' : 'AVAILABLE'
        } else {
          slotInfo.availability[therapistName] = 'NOT_AVAILABLE'
        }
      })

      return slotInfo
    })

    return {
      data: { therapists: therapistsToday, slots: slotsResult as SlotsData['slots'] },
      error: null,
    }
  } catch (e) {
    return { data: null, error: e as Error }
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Booking Operations
// ─────────────────────────────────────────────────────────────────────

export async function processBooking(bookingInfo: BookingInfo): Promise<ApiResult<{ success: boolean; message: string }>> {
  try {
    const newBookingId = `BK-${bookingInfo.date.replace(/-/g, '')}-${bookingInfo.time.replace(':', '')}-${bookingInfo.therapist.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`

    const payload = {
      date: bookingInfo.date,
      time: bookingInfo.time,
      therapist: bookingInfo.therapist,
      patientId: bookingInfo.patientId,
      patientFirstName: bookingInfo.patientFirstName,
      patientLastName: bookingInfo.patientLastName,
      patientPhone: bookingInfo.patientPhone,
      bookingId: newBookingId,
    }

    const { data, error } = await supabase.rpc('process_booking', { booking_info: payload })
    if (error) throw error

    return { data, error: null }
  } catch (e) {
    return { data: null, error: e as Error }
  }
}

export async function findMyBookings(patientId: string): Promise<ApiResult<Booking[]>> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('patient_id', patientId.trim())
      .gte('booking_date', formatDateToYYYYMMDD(new Date()))
      .order('booking_date', { ascending: true })

    if (error) throw error
    return { data: data ?? [], error: null }
  } catch (e) {
    return { data: null, error: e as Error }
  }
}

export async function cancelBooking(bookingData: Booking): Promise<ApiResult<{ success: boolean; message: string }>> {
  try {
    const { error: insertError } = await supabase.from('cancellations').insert([
      {
        reason: 'ยกเลิกโดยผู้จัดการ',
        booking_id: bookingData.booking_id,
        original_timestamp: bookingData.created_at,
        booking_date: bookingData.booking_date,
        booking_time: bookingData.booking_time,
        therapist_name: bookingData.therapist_name,
        patient_id: bookingData.patient_id,
        patient_first_name: bookingData.patient_first_name,
        patient_last_name: bookingData.patient_last_name,
        patient_phone: bookingData.patient_phone,
        original_status: bookingData.status,
      },
    ])
    if (insertError) throw insertError

    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('booking_id', bookingData.booking_id)
    if (deleteError) throw deleteError

    return {
      data: { success: true, message: 'ยกเลิกการจองสำเร็จ' },
      error: null,
    }
  } catch (e) {
    return { data: null, error: e as Error }
  }
}

// ─────────────────────────────────────────────────────────────────────
//  Dashboard Stats
// ─────────────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<ApiResult<DashboardStats>> {
  try {
    const now = new Date()
    const startOfMonth = formatDateToYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), 1))
    const endOfMonth = formatDateToYYYYMMDD(new Date(now.getFullYear(), now.getMonth() + 1, 0))

    const [{ data: statsData, error: e1 }, { count: monthlyCount, error: e2 }] =
      await Promise.all([
        supabase.from('stats').select('metric_name, value'),
        supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfMonth + 'T00:00:00Z')
          .lte('created_at', endOfMonth + 'T23:59:59Z'),
      ])

    const fetchError = e1 || e2
    if (fetchError) throw fetchError

    const manualCount =
      (statsData ?? []).find((s: { metric_name: string }) => s.metric_name === 'ManualInitialCount')
        ?.value ?? 0
    const systemCount =
      (statsData ?? []).find((s: { metric_name: string }) => s.metric_name === 'SystemBookingCount')
        ?.value ?? 0

    return {
      data: {
        totalBookings: manualCount + systemCount,
        monthlyBookings: monthlyCount ?? 0,
      },
      error: null,
    }
  } catch (e) {
    return { data: null, error: e as Error }
  }
}
