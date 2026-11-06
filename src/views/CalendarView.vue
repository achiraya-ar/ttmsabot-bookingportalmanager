<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import Swal from "sweetalert2";
import { useAppStore } from "@/stores/appStore";
import { getFilterOptions, getCalendarData, findMyBookings } from "@/services/api";
import { formatThaiMonthYear } from "@/utils/dateUtils";
import { createPrintAllSlip } from "@/utils/printUtils";
import type { FilterOptions, CalendarData, Filters } from "@/types";

const store = useAppStore();

// ─── Local State ──────────────────────────────────────────────────────
const isLoading = ref(true);
const filterOptions = ref<FilterOptions>({
    therapists: [],
    timeSlots: [],
    maxPeople: 1,
    therapistTimeMap: {},
});
const calendarData = ref<CalendarData>({});
const calendarLoading = ref(false);
const showPrintPicker = ref(false);
const selectedPrintPatientId = ref("");
const isPrintLoading = ref(false);

// ─── Filter State ─────────────────────────────────────────────────────
const selectedPeople = ref("1");
const selectedTherapist = ref("");
const selectedTimeSlot = ref("");

// ─── Computed ─────────────────────────────────────────────────────────
const currentMonthLabel = computed(() =>
    formatThaiMonthYear(store.currentDate),
);

const firstDayIndex = computed(() =>
    new Date(
        store.currentDate.getFullYear(),
        store.currentDate.getMonth(),
        1,
    ).getDay(),
);

const daysInMonth = computed(() =>
    new Date(
        store.currentDate.getFullYear(),
        store.currentDate.getMonth() + 1,
        0,
    ).getDate(),
);

const calendarDays = computed(() => {
    const days: Array<{ day: number; dateStr: string; status: string } | null> =
        [];

    // Empty cells before first day
    for (let i = 0; i < firstDayIndex.value; i++) {
        days.push(null);
    }

    // Actual days
    for (let d = 1; d <= daysInMonth.value; d++) {
        const dateStr = `${store.currentDate.getFullYear()}-${(
            store.currentDate.getMonth() + 1
        )
            .toString()
            .padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
        const status = calendarData.value[dateStr] || "DISABLED";
        days.push({ day: d, dateStr, status: status.toLowerCase() });
    }

    return days;
});

// Available time slots filtered by selected therapist
const availableTimeSlots = computed(() => {
    if (
        selectedTherapist.value &&
        filterOptions.value.therapistTimeMap[selectedTherapist.value]
    ) {
        return filterOptions.value.therapistTimeMap[selectedTherapist.value];
    }
    return filterOptions.value.timeSlots;
});

const isTherapistDisabled = computed(() => parseInt(selectedPeople.value) > 1);

const peopleOptions = computed(() => {
    const options = [];
    for (let i = 1; i <= filterOptions.value.maxPeople; i++) {
        options.push(i);
    }
    return options;
});

type SessionPatient = {
    patient_id: string;
    name: string;
    count: number;
};

const sessionPatients = computed<SessionPatient[]>(() => {
    const patients = new Map<string, SessionPatient>();

    for (const booking of store.completedBookings) {
        const existing = patients.get(booking.patient_id);
        if (existing) {
            existing.count += 1;
            continue;
        }

        const name =
            `${booking.patient_first_name} ${booking.patient_last_name}`.trim();
        patients.set(booking.patient_id, {
            patient_id: booking.patient_id,
            name: name || booking.patient_id,
            count: 1,
        });
    }

    return Array.from(patients.values());
});

const sessionPatientNames = computed(() =>
    sessionPatients.value.map((patient) => patient.name).join(", "),
);

// ─── Watchers ─────────────────────────────────────────────────────────
watch(selectedPeople, (newVal) => {
    if (parseInt(newVal) > 1) {
        selectedTherapist.value = "";
        // keep timeSlot but re-compute available slots
    }
});

watch(selectedTherapist, (newVal) => {
    if (newVal !== "") {
        selectedPeople.value = "1";
    }
    // Reset time slot if not available for selected therapist
    if (
        selectedTimeSlot.value &&
        newVal &&
        filterOptions.value.therapistTimeMap[newVal] &&
        !filterOptions.value.therapistTimeMap[newVal].includes(
            selectedTimeSlot.value,
        )
    ) {
        selectedTimeSlot.value = "";
    }
});

// ─── Methods ──────────────────────────────────────────────────────────
async function loadFilterOptions() {
    const { data, error } = await getFilterOptions(true);
    if (error) throw error;
    if (data) filterOptions.value = data;
}

async function updateCalendarView() {
    calendarLoading.value = true;
    const filters: Filters = {
        people: selectedPeople.value,
        therapist: selectedTherapist.value,
        timeSlot: selectedTimeSlot.value,
    };
    // Sync filters to store
    store.currentFilters = filters;

    // Keep the remaining count in sync with the currently selected filters.
    // Example: 2 people selected and 1 person already booked → 1 remaining.
    const selectedPeopleCount = parseInt(selectedPeople.value || "1", 10);
    const totalPeople =
        isNaN(selectedPeopleCount) || selectedPeopleCount < 1
            ? 1
            : selectedPeopleCount;
    store.setRemainingToBook(
        Math.max(1, totalPeople - store.bookedInFlow),
    );

    try {
        const { data: response, error } = await getCalendarData(
            store.currentDate.getMonth(),
            store.currentDate.getFullYear(),
            true,
            filters,
        );
        if (error) throw error;
        if (!response) return;

        if (response.status === "FOUND_IN_FUTURE") {
            await Swal.fire({
                icon: "info",
                title: "ไม่พบคิวว่างในเดือนนี้",
                text: "ระบบกำลังแสดงเดือนถัดไปที่ใกล้ที่สุดที่มีคิวว่างตามเงื่อนไข",
                timer: 2500,
                showConfirmButton: false,
            });
            store.currentDate = new Date(
                response.newYear,
                response.newMonth,
                1,
            );
            calendarData.value = response.data;
        } else if (response.status === "NOT_FOUND") {
            Swal.fire({
                icon: "warning",
                title: "ไม่พบคิวว่าง",
                text: "ไม่พบคิวว่างตามเงื่อนไขที่คุณเลือก กรุณาลองเปลี่ยนเงื่อนไขการค้นหา",
            });
            calendarData.value = response.data;
        } else {
            calendarData.value = response.data;
        }
    } catch (err) {
        const e = err as Error;
        Swal.fire("เกิดข้อผิดพลาด", `ระบบขัดข้อง: ${e.message || ""}`, "error");
    } finally {
        calendarLoading.value = false;
    }
}

function prevMonth() {
    const d = new Date(store.currentDate);
    d.setMonth(d.getMonth() - 1);
    store.currentDate = d;
    updateCalendarView();
}

function nextMonth() {
    const d = new Date(store.currentDate);
    d.setMonth(d.getMonth() + 1);
    store.currentDate = d;
    updateCalendarView();
}

function resetFilters() {
    selectedPeople.value = "1";
    selectedTherapist.value = "";
    selectedTimeSlot.value = "";
    store.currentDate = new Date();
    store.currentFilters = {};
    updateCalendarView();
}

function onDateClick(dateStr: string, status: string) {
    if (status !== "available") return;
    store.selectDate(dateStr);
}

function openPrintPicker() {
    const patients = sessionPatients.value;
    if (patients.length === 0) return;

    if (patients.length === 1) {
        void printCombinedSlip(patients[0].patient_id);
        return;
    }

    selectedPrintPatientId.value = patients[0].patient_id;
    showPrintPicker.value = true;
}

async function printCombinedSlip(patientId: string) {
    if (!patientId || isPrintLoading.value) return;

    isPrintLoading.value = true;
    try {
        const { data, error } = await findMyBookings(patientId);
        if (error) throw error;

        const bookings = data ?? [];
        if (bookings.length === 0) {
            await Swal.fire(
                "ไม่พบรายการนัดหมาย",
                "ไม่พบรายการนัดหมายที่ยังมาไม่ถึงสำหรับผู้ป่วยรายนี้",
                "warning",
            );
            return;
        }

        createPrintAllSlip(bookings);
        showPrintPicker.value = false;
    } catch (err) {
        const e = err as Error;
        Swal.fire(
            "เกิดข้อผิดพลาด",
            `ระบบขัดข้อง: ${e.message || ""}`,
            "error",
        );
    } finally {
        isPrintLoading.value = false;
    }
}

function confirmPrintSelected() {
    void printCombinedSlip(selectedPrintPatientId.value);
}

/**
 * คืนค่าตัวกรองที่เคยเลือกไว้ (จำนวนคน / ผู้ให้บริการ / ช่วงเวลา)
 * เพื่อให้หลังจากจองเสร็จและกลับมาที่ปฏิทิน เงื่อนไขเดิมยังอยู่ครบ
 */
function restoreSavedFilters() {
    const saved = store.currentFilters;
    if (!saved) return;

    selectedPeople.value = String(saved.people ?? "1");
    selectedTherapist.value =
        typeof saved.therapist === "string" ? saved.therapist : "";
    selectedTimeSlot.value =
        typeof saved.timeSlot === "string" ? saved.timeSlot : "";
}

/** ตรวจสอบว่าค่าที่คืนมายังใช้ได้กับตัวเลือกปัจจุบัน */
function normalizeRestoredFilters() {
    const maxPeople = Math.max(1, filterOptions.value.maxPeople);
    const people = parseInt(selectedPeople.value || "1", 10);
    if (isNaN(people) || people < 1) {
        selectedPeople.value = "1";
    } else if (people > maxPeople) {
        selectedPeople.value = String(maxPeople);
    }

    if (
        selectedTherapist.value &&
        !filterOptions.value.therapists.includes(selectedTherapist.value)
    ) {
        selectedTherapist.value = "";
    }

    const slots = selectedTherapist.value
        ? (filterOptions.value.therapistTimeMap[selectedTherapist.value] ??
          filterOptions.value.timeSlots)
        : filterOptions.value.timeSlots;

    if (selectedTimeSlot.value && !slots.includes(selectedTimeSlot.value)) {
        selectedTimeSlot.value = "";
    }
}

// ─── Lifecycle ────────────────────────────────────────────────────────
onMounted(async () => {
    isLoading.value = true;
    try {
        await loadFilterOptions();
        restoreSavedFilters();
        normalizeRestoredFilters();
        await updateCalendarView();
    } catch (err) {
        const e = err as Error;
        Swal.fire("เกิดข้อผิดพลาด", `ระบบขัดข้อง: ${e.message || ""}`, "error");
        store.backToDashboard();
    } finally {
        isLoading.value = false;
    }
});
</script>

<template>
    <div id="calendar-view">
        <!-- Page Title -->
        <h2 class="page-title">
            <i class="fa-solid fa-calendar-days"></i>เลือกวันนัดหมาย
        </h2>

        <!-- Booker Summary -->
        <div v-if="store.currentPatientData" class="booking-summary">
            <p class="summary-item">
                <template v-if="store.currentPatientData.first_name">
                    <i class="fa-solid fa-user-check"></i>
                    <strong>ผู้จอง:</strong>
                    {{ store.currentPatientData.first_name }}
                    {{ store.currentPatientData.last_name }}
                </template>
                <template v-else>
                    <i class="fa-solid fa-user-plus"></i>
                    <strong>กำลังจองสำหรับผู้ป่วยใหม่ ID:</strong>
                    {{ store.currentPatientData.patient_id }}
                </template>
            </p>
        </div>

        <!-- Completed bookings in this session -->
        <div
            v-if="store.completedBookings.length > 0"
            class="booking-summary"
            style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 1rem;
                flex-wrap: wrap;
            "
        >
            <div>
                <p class="summary-item" style="margin: 0">
                    <i
                        class="fa-solid fa-circle-check"
                        style="color: var(--status-green)"
                    ></i>
                    <strong>จองสำเร็จแล้ว {{ store.completedBookings.length }} รายการ</strong>
                </p>
                <p
                    class="summary-item"
                    style="margin: 0.35rem 0 0; font-size: 0.9em; overflow-wrap: anywhere"
                >
                    <i class="fa-solid fa-id-card"></i>
                    <strong>ผู้ป่วยที่จอง:</strong>
                    {{ sessionPatientNames }}
                </p>
            </div>

            <button
                type="button"
                class="btn"
                :disabled="isPrintLoading"
                @click="openPrintPicker"
            >
                <i
                    v-if="isPrintLoading"
                    class="fas fa-spinner fa-spin"
                ></i>
                <i v-else class="fa-solid fa-print"></i>
                พิมพ์ใบนัดรวม ({{ sessionPatients.length }})
            </button>
        </div>

        <!-- Loading overlay for initial load -->
        <div v-if="isLoading" class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <p>กำลังโหลดปฏิทิน...</p>
        </div>

        <template v-else>
            <!-- Filter Container -->
            <div class="filter-container">
                <div class="filter-grid">
                    <!-- People filter -->
                    <div class="filter-group">
                        <label for="people-filter">
                            <i class="fa-solid fa-users"></i>
                            จำนวนผู้เข้ารับบริการ
                        </label>
                        <select
                            id="people-filter"
                            v-model="selectedPeople"
                            :disabled="
                                isTherapistDisabled && selectedTherapist !== ''
                            "
                        >
                            <option
                                v-for="n in peopleOptions"
                                :key="n"
                                :value="String(n)"
                            >
                                {{ n }} คน
                            </option>
                        </select>
                    </div>

                    <!-- Therapist filter -->
                    <div class="filter-group">
                        <label for="therapist-filter">
                            <i class="fa-solid fa-user-doctor"></i>
                            ผู้ให้บริการ
                        </label>
                        <select
                            id="therapist-filter"
                            v-model="selectedTherapist"
                            :disabled="parseInt(selectedPeople) > 1"
                        >
                            <option value="">ทั้งหมด</option>
                            <option
                                v-for="therapist in filterOptions.therapists"
                                :key="therapist"
                                :value="therapist"
                            >
                                {{ therapist }}
                            </option>
                        </select>
                    </div>

                    <!-- Time slot filter -->
                    <div class="filter-group">
                        <label for="timeslot-filter">
                            <i class="fa-solid fa-clock"></i> ช่วงเวลา
                        </label>
                        <select id="timeslot-filter" v-model="selectedTimeSlot">
                            <option value="">ทุกช่วงเวลา</option>
                            <option
                                v-for="slot in availableTimeSlots"
                                :key="slot"
                                :value="slot"
                            >
                                {{ slot }} น.
                            </option>
                        </select>
                    </div>
                </div>

                <div class="filter-actions">
                    <button class="btn-reset" @click="resetFilters">
                        <i class="fa-solid fa-rotate-left"></i> รีเซ็ตตัวกรอง
                    </button>
                    <button
                        class="btn btn-search-filter"
                        :disabled="calendarLoading"
                        @click="updateCalendarView"
                    >
                        <i
                            v-if="calendarLoading"
                            class="fas fa-spinner fa-spin"
                        ></i>
                        <i v-else class="fa-solid fa-magnifying-glass"></i>
                        {{ calendarLoading ? "กำลังค้นหา..." : "ค้นหาคิวว่าง" }}
                    </button>
                </div>
            </div>

            <!-- Calendar Header (month nav) -->
            <div id="calendar-header" class="calendar-header">
                <button
                    class="btn btn-secondary btn-slot"
                    :disabled="calendarLoading"
                    @click="prevMonth"
                >
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <h2 id="calendar-month-year">{{ currentMonthLabel }}</h2>
                <button
                    class="btn btn-secondary btn-slot"
                    :disabled="calendarLoading"
                    @click="nextMonth"
                >
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>

            <!-- Calendar Grid Wrapper -->
            <div id="calendar-grid-wrapper">
                <!-- Calendar Loading -->
                <div
                    v-if="calendarLoading"
                    class="loading-spinner"
                    style="padding: 2rem"
                >
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>กำลังค้นหาคิวว่าง...</p>
                </div>

                <!-- Calendar Grid -->
                <div v-else class="calendar-grid">
                    <!-- Day name headers -->
                    <div class="day-name">อา</div>
                    <div class="day-name">จ</div>
                    <div class="day-name">อ</div>
                    <div class="day-name">พ</div>
                    <div class="day-name">พฤ</div>
                    <div class="day-name">ศ</div>
                    <div class="day-name">ส</div>

                    <!-- Empty cells -->
                    <div v-for="i in firstDayIndex" :key="`empty-${i}`"></div>

                    <!-- Day cells -->
                    <div
                        v-for="dayInfo in calendarDays.filter(Boolean)"
                        :key="dayInfo!.dateStr"
                        class="calendar-day"
                        :class="`date-${dayInfo!.status}`"
                        :data-date="dayInfo!.dateStr"
                        @click="onDateClick(dayInfo!.dateStr, dayInfo!.status)"
                    >
                        {{ dayInfo!.day }}
                    </div>
                </div>
            </div>

            <!-- Legend -->
            <div class="calendar-legend">
                <div class="legend-item">
                    <div
                        class="legend-color"
                        style="background-color: var(--status-green)"
                    ></div>
                    <span>มีคิวว่าง</span>
                </div>
                <div class="legend-item">
                    <div
                        class="legend-color"
                        style="background-color: var(--status-red)"
                    ></div>
                    <span>คิวเต็ม</span>
                </div>
                <div class="legend-item">
                    <div
                        class="legend-color"
                        style="
                            background-color: var(--status-disabled-bg);
                            border: 1px solid #ccc;
                        "
                    ></div>
                    <span>ปิดบริการ</span>
                </div>
            </div>
        </template>

        <!-- Back button -->
        <div class="btn-action-group" style="margin-top: 2rem">
            <button class="btn btn-secondary" @click="store.backToDashboard()">
                <i class="fa-solid fa-home"></i> กลับหน้าหลัก
            </button>
        </div>

        <!-- Print picker: choose which patient's combined slip to print -->
        <Teleport to="body">
            <div
                v-if="showPrintPicker"
                class="modal-overlay"
                @click.self="showPrintPicker = false"
            >
                <div
                    class="modal-content"
                    style="max-width: 560px"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="print-picker-title"
                >
                    <div class="modal-header">
                        <h2 id="print-picker-title">
                            <i class="fa-solid fa-print"></i>
                            เลือกผู้ป่วยที่ต้องการพิมพ์
                        </h2>
                        <button
                            type="button"
                            class="modal-close-btn"
                            aria-label="ปิด"
                            @click="showPrintPicker = false"
                        >
                            &times;
                        </button>
                    </div>

                    <div class="modal-body">
                        <p>
                            พิมพ์ใบนัดรวมของผู้ป่วยแต่ละคน
                            โดยระบบจะดึงรายการนัดหมายที่ยังมาไม่ถึงทั้งหมดของไอดีนั้น
                        </p>

                        <div class="print-patient-list">
                            <label
                                v-for="patient in sessionPatients"
                                :key="patient.patient_id"
                                class="print-patient-option"
                            >
                                <input
                                    v-model="selectedPrintPatientId"
                                    type="radio"
                                    name="print-patient"
                                    :value="patient.patient_id"
                                />
                                <span>
                                    <strong>{{ patient.name }}</strong>
                                    <small>
                                        เลขบัตร {{ patient.patient_id }}
                                        · จองในรอบนี้ {{ patient.count }} รายการ
                                    </small>
                                </span>
                            </label>
                        </div>

                        <div class="btn-action-group" style="margin-top: 1.5rem">
                            <button
                                type="button"
                                class="btn btn-secondary"
                                :disabled="isPrintLoading"
                                @click="showPrintPicker = false"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                class="btn"
                                :disabled="!selectedPrintPatientId || isPrintLoading"
                                @click="confirmPrintSelected"
                            >
                                <i
                                    v-if="isPrintLoading"
                                    class="fas fa-spinner fa-spin"
                                ></i>
                                <i v-else class="fa-solid fa-print"></i>
                                พิมพ์ใบนัดรวม
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
