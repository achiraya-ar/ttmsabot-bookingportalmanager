// =====================================================================
//  Pinia Store - Global App State สำหรับ Manager Portal
// =====================================================================

import { defineStore } from "pinia";
import { ref } from "vue";
import type { Patient, Filters, AppView } from "@/types";

export const useAppStore = defineStore("app", () => {
  // ─── Current View ───────────────────────────────────────────────────
  const currentView = ref<AppView>("loading");

  // ─── Auth State ─────────────────────────────────────────────────────
  const isManagerLoggedIn = ref(false);

  // ─── Calendar / Booking Context ─────────────────────────────────────
  const currentDate = ref(new Date());
  const currentFilters = ref<Filters>({});
  const currentPatientData = ref<Patient | null>(null);

  // ─── Slot Selection Context ─────────────────────────────────────────
  const selectedDate = ref("");
  const selectedTime = ref("");
  const selectedTherapist = ref("");

  // ─── Multi-booking state ────────────────────────────────────────────
  // จำนวนคงเหลือสำหรับการจองแบบหลายคน (เริ่มต้น 1)
  const remainingToBook = ref<number>(1);

  // ─── Navigation ─────────────────────────────────────────────────────
  function navigateTo(view: AppView) {
    currentView.value = view;
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // ─── Auth Actions ────────────────────────────────────────────────────
  function login() {
    isManagerLoggedIn.value = true;
    sessionStorage.setItem("isManagerLoggedIn", "true");
  }

  function logout() {
    isManagerLoggedIn.value = false;
    sessionStorage.removeItem("isManagerLoggedIn");
    resetBookingContext();
  }

  function initialize() {
    if (sessionStorage.getItem("isManagerLoggedIn") === "true") {
      isManagerLoggedIn.value = true;
      navigateTo("dashboard");
    } else {
      navigateTo("login");
    }
  }

  // ─── Booking Context Actions ─────────────────────────────────────────
  function startBookingFlow(patient: Patient | null) {
    // don't clear filters here so calendar/slots choices (people, therapist, timeslot) are preserved
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
    // keep selectedDate so the user stays on the same day, but force them to pick a new time/therapist
    selectedTime.value = "";
    selectedTherapist.value = "";
    navigateTo("slots");
  }

  function resetBookingContext() {
    currentPatientData.value = null;
    currentFilters.value = {};
    selectedDate.value = "";
    selectedTime.value = "";
    selectedTherapist.value = "";
    currentDate.value = new Date();
    remainingToBook.value = 1;
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

  return {
    // state
    currentView,
    isManagerLoggedIn,
    currentDate,
    currentFilters,
    currentPatientData,
    selectedDate,
    selectedTime,
    selectedTherapist,
    remainingToBook,

    // actions
    navigateTo,
    login,
    logout,
    initialize,
    startBookingFlow,
    selectDate,
    selectSlot,
    prepareNextPersonSelectSlot,
    resetBookingContext,
    backToDashboard,
    setRemainingToBook,
    decrementRemainingToBook,
  };
});
