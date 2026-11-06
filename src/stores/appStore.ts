// =====================================================================
//  Pinia Store - Global App State สำหรับ Manager Portal
// =====================================================================

import { defineStore } from "pinia";
import { ref } from "vue";
import { getSessionProfile, signOut } from "@/services/auth";
import type { Patient, Booking, Filters, AppView, UserProfile } from "@/types";

export const useAppStore = defineStore("app", () => {
  // ─── Current View ───────────────────────────────────────────────────
  const currentView = ref<AppView>("loading");

  // ─── Auth State ─────────────────────────────────────────────────────
  const isManagerLoggedIn = ref(false);
  const currentUser = ref<UserProfile | null>(null);

  // ─── Calendar / Booking Context ─────────────────────────────────────
  const currentDate = ref(new Date());
  const currentFilters = ref<Filters>({});
  const currentPatientData = ref<Patient | null>(null);
  // ผู้ป่วย/ไอดีหลักที่ใช้เริ่มการจองรอบนี้
  const primaryPatient = ref<Patient | null>(null);

  // ─── Slot Selection Context ─────────────────────────────────────────
  const selectedDate = ref("");
  const selectedTime = ref("");
  const selectedTherapist = ref("");

  // ─── Multi-booking state ────────────────────────────────────────────
  // จำนวนคงเหลือสำหรับการจองแบบหลายคน (เริ่มต้น 1)
  const remainingToBook = ref<number>(1);
  // จำนวนคนที่จองสำเร็จแล้วในรอบการจองปัจจุบัน
  const bookedInFlow = ref<number>(0);
  // รายการจองที่ทำสำเร็จในรอบปัจจุบัน (ใช้สำหรับพิมพ์ใบนัดรวมจากหน้าปฏิทิน)
  const completedBookings = ref<Booking[]>([]);
  // กำลังรอให้ระบุตัวตนของผู้เข้ารับบริการคนถัดไปหรือไม่
  const awaitingNextPatient = ref(false);

  // ─── Navigation ─────────────────────────────────────────────────────
  function navigateTo(view: AppView) {
    currentView.value = view;
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // ─── Auth Actions ────────────────────────────────────────────────────
  function login(profile: UserProfile) {
    currentUser.value = profile;
    isManagerLoggedIn.value = true;
  }

  async function logout() {
    try {
      await signOut();
    } catch (err) {
      console.error("Cannot sign out:", err);
    } finally {
      currentUser.value = null;
      isManagerLoggedIn.value = false;
      resetBookingContext();
    }
  }

  async function initialize() {
    try {
      const profile = await getSessionProfile();

      if (profile?.can_access_bookingportalmanager) {
        currentUser.value = profile;
        isManagerLoggedIn.value = true;
        navigateTo("dashboard");
        return;
      }

      // Session exists but this account may not use this app.
      if (profile) await signOut().catch(() => undefined);
    } catch (err) {
      console.error("Cannot restore session:", err);
      await signOut().catch(() => undefined);
    }

    currentUser.value = null;
    isManagerLoggedIn.value = false;
    navigateTo("login");
  }

  // ─── Booking Context Actions ─────────────────────────────────────────
  function startBookingFlow(patient: Patient | null) {
    // don't clear filters here so calendar/slots choices (people, therapist, timeslot) are preserved
    awaitingNextPatient.value = false;
    bookedInFlow.value = 0;
    completedBookings.value = [];
    primaryPatient.value = patient ? { ...patient } : null;
    currentPatientData.value = patient;
    currentDate.value = new Date();
    // initialise remainingToBook from currentFilters if present
    const parsed = parseInt((currentFilters.value?.people as string) || "1");
    remainingToBook.value = isNaN(parsed) || parsed < 1 ? 1 : parsed;
    selectedDate.value = "";
    selectedTime.value = "";
    selectedTherapist.value = "";
    navigateTo("calendar");
  }

  function selectDate(date: string) {
    selectedDate.value = date;
    navigateTo("slots");
  }

  function selectSlot(date: string, time: string, therapist: string) {
    selectedDate.value = date;
    selectedTime.value = time;
    selectedTherapist.value = therapist;
    navigateTo("booking-form");
  }

  /**
   * ระบุผู้เข้ารับบริการคนถัดไปหลังจองคนก่อนหน้าเสร็จแล้ว
   * - ไม่รีเซ็ตจำนวนคนที่เหลือ
   * - คงวันที่และตัวกรองเดิมไว้
   * - ล้างเวลา/ผู้ให้บริการ เพื่อให้เลือกใหม่สำหรับคนถัดไป
   */
  function selectNextPatient(patient: Patient) {
    currentPatientData.value = patient;
    awaitingNextPatient.value = false;
    selectedTime.value = "";
    selectedTherapist.value = "";
    navigateTo("slots");
  }

  /** อัปเดตข้อมูลไอดีหลัก เช่น กรณีผู้ป่วยใหม่ที่เพิ่งกรอกชื่อในฟอร์ม */
  function updatePrimaryPatient(patient: Patient) {
    primaryPatient.value = { ...patient };
  }

  /**
   * จบรอบการจองหลายคน แล้วกลับไปใช้ไอดีหลักที่เริ่มจองครั้งแรก
   * พร้อมคงจำนวนคนและตัวกรองเดิมไว้สำหรับรอบถัดไป
   */
  function restorePrimaryPatient() {
    currentPatientData.value = primaryPatient.value
      ? { ...primaryPatient.value }
      : null;
    selectedTime.value = "";
    selectedTherapist.value = "";
    bookedInFlow.value = 0;
    awaitingNextPatient.value = false;

    const parsed = parseInt(String(currentFilters.value?.people ?? "1"), 10);
    remainingToBook.value = isNaN(parsed) || parsed < 1 ? 1 : parsed;
  }

  /**
   * Prepare for the next person in a multi-booking flow:
   * - decrement remaining count
   * - clear currentPatientData so form becomes editable
   * - keep the selectedDate (same day) but clear selectedTime/selectedTherapist
   * - navigate the user to the slots page so they can pick a time/therapist for the next person
   */
  function prepareNextPersonSelectSlot() {
    if (remainingToBook.value > 0) {
      remainingToBook.value = Math.max(0, remainingToBook.value - 1);
    }
    currentPatientData.value = null;
    awaitingNextPatient.value = false;
    // keep selectedDate so the user stays on the same day, but force them to pick a new time/therapist
    selectedTime.value = "";
    selectedTherapist.value = "";
    navigateTo("slots");
  }

  function resetBookingContext() {
    currentPatientData.value = null;
    primaryPatient.value = null;
    currentFilters.value = {};
    selectedDate.value = "";
    selectedTime.value = "";
    selectedTherapist.value = "";
    currentDate.value = new Date();
    remainingToBook.value = 1;
    bookedInFlow.value = 0;
    completedBookings.value = [];
    awaitingNextPatient.value = false;
  }

  function backToDashboard() {
    resetBookingContext();
    navigateTo("dashboard");
  }

  // small helpers to mutate remainingToBook from other components if needed
  function setRemainingToBook(count: number) {
    remainingToBook.value = isNaN(count) || count < 1 ? 1 : Math.floor(count);
  }

  function decrementRemainingToBook() {
    remainingToBook.value = Math.max(0, remainingToBook.value - 1);
  }

  /** บันทึกว่าจองสำเร็จไปแล้วหนึ่งคนในรอบการจองปัจจุบัน */
  function recordCompletedBooking(booking: Booking) {
    bookedInFlow.value += 1;
    completedBookings.value.push({ ...booking });
  }

  return {
    // state
    currentView,
    isManagerLoggedIn,
    currentUser,
    currentDate,
    currentFilters,
    currentPatientData,
    primaryPatient,
    selectedDate,
    selectedTime,
    selectedTherapist,
    remainingToBook,
    bookedInFlow,
    completedBookings,
    awaitingNextPatient,

    // actions
    navigateTo,
    login,
    logout,
    initialize,
    startBookingFlow,
    selectDate,
    selectSlot,
    selectNextPatient,
    updatePrimaryPatient,
    restorePrimaryPatient,
    prepareNextPersonSelectSlot,
    resetBookingContext,
    backToDashboard,
    setRemainingToBook,
    decrementRemainingToBook,
    recordCompletedBooking,
  };
});
