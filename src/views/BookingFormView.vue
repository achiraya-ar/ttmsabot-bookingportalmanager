<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import Swal from "sweetalert2";
import { useAppStore } from "@/stores/appStore";
import { processBooking, registerNewPatient, updatePatientData, updateBookingPatientData } from "@/services/api";
import { formatThaiDate } from "@/utils/dateUtils";
import { createPrintSlip } from "@/utils/printUtils";
import type { BookingInfo } from "@/types";

const store = useAppStore();

// ─── Form State ────────────────────────────────────────────────────────
const patientId = ref("");
const patientFirstName = ref("");
const patientLastName = ref("");
const patientPhone = ref("");
const pdpaConsented = ref(false);
const isSubmitting = ref(false);
const showPdpaModal = ref(false);

// ─── Multi-person booking state (use store-managed counter)
// Initialize store.remainingToBook from the calendar filters if not already set.
if (!store.remainingToBook || store.remainingToBook < 1) {
    const parsed = parseInt((store.currentFilters?.people as string) || "1");
    store.setRemainingToBook(isNaN(parsed) || parsed < 1 ? 1 : parsed);
}

// ─── Computed ──────────────────────────────────────────────────────────
const isRegisteredPatient = computed(
    () => !!store.currentPatientData?.first_name,
);

// ─── Lifecycle ─────────────────────────────────────────────────────────
onMounted(() => {
    if (
        !store.selectedDate ||
        !store.selectedTime ||
        !store.selectedTherapist
    ) {
        store.navigateTo("calendar");
        return;
    }

    // Pre-fill from store
    if (store.currentPatientData) {
        patientId.value = store.currentPatientData.patient_id;
        patientFirstName.value = store.currentPatientData.first_name || "";
        patientLastName.value = store.currentPatientData.last_name || "";
        patientPhone.value = store.currentPatientData.phone_number || "";
    }
});

// ─── Methods ────────────────────────────────────────────────────────────
function goBack() {
    // Return to slots so user can change time/therapist if desired.
    store.navigateTo("slots");
}

async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!pdpaConsented.value) {
        Swal.fire(
            "ข้อผิดพลาด",
            "กรุณายินยอมในนโยบายคุ้มครองข้อมูลส่วนบุคคลก่อนทำการจอง",
            "warning",
        );
        return;
    }

    if (
        !patientId.value ||
        !patientFirstName.value ||
        !patientLastName.value ||
        !patientPhone.value
    ) {
        Swal.fire("ข้อผิดพลาด", "กรุณากรอกข้อมูลให้ครบถ้วน", "warning");
        return;
    }

    isSubmitting.value = true;

    Swal.fire({
        title: "กำลังบันทึกการจอง...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
    });

    try {
        const trimmedFirstName = patientFirstName.value.trim();
        const trimmedLastName = patientLastName.value.trim();
        const trimmedPhone = patientPhone.value.trim();

        // ผู้ป่วยใหม่ที่ยังไม่ลงทะเบียน → ลงทะเบียนให้อัตโนมัติ
        // โดยยังไม่เปิดให้ผู้ป่วยจองคิวเองผ่านหน้าเว็บ (can_self_book = false)
        // ผู้ป่วยที่ลงทะเบียนแล้ว → อัปเดตข้อมูลในทะเบียนผู้ป่วยและรายการจองเดิม
        const original = store.currentPatientData;
        const hasPatientDataChanged =
            !original ||
            trimmedFirstName !== (original.first_name || "") ||
            trimmedLastName !== (original.last_name || "") ||
            trimmedPhone !== (original.phone_number || "");

        if (!isRegisteredPatient.value) {
            const { error: registerError } = await registerNewPatient({
                patient_id: patientId.value.trim(),
                first_name: trimmedFirstName,
                last_name: trimmedLastName,
                phone_number: trimmedPhone,
                can_self_book: false,
            });
            if (registerError) throw registerError;
        } else if (hasPatientDataChanged) {
            const { error: patientError } = await updatePatientData(
                patientId.value,
                {
                    first_name: trimmedFirstName,
                    last_name: trimmedLastName,
                    phone_number: trimmedPhone,
                },
            );
            if (patientError) throw patientError;
        }

        if (hasPatientDataChanged) {
            const { error: bookingDataError } =
                await updateBookingPatientData(patientId.value, {
                    first_name: trimmedFirstName,
                    last_name: trimmedLastName,
                    phone_number: trimmedPhone,
                });
            if (bookingDataError) throw bookingDataError;
        }

        const bookingInfo: BookingInfo = {
            date: store.selectedDate,
            time: store.selectedTime,
            therapist: store.selectedTherapist,
            patientId: patientId.value,
            patientFirstName: trimmedFirstName,
            patientLastName: trimmedLastName,
            patientPhone: trimmedPhone,
        };

        const { data: res, error } = await processBooking(bookingInfo);
        if (error) throw error;

        if (res && res.success) {
            const printResult = await Swal.fire({
                title: "จองสำเร็จ!",
                icon: "success",
                confirmButtonText:
                    '<i class="fa-solid fa-print"></i> พิมพ์ใบนัด',
                showCloseButton: true,
                html: `
          <div>
            <h3><i class="fa-solid fa-ticket"></i> ใบยืนยันการจอง</h3>
            <p><strong>ผู้จอง:</strong> ${patientFirstName.value} ${patientLastName.value}</p>
            <p><strong>ชื่อหมอ:</strong> ${store.selectedTherapist}</p>
            <p><strong>วันที่นัด:</strong> ${formatThaiDate(store.selectedDate)}</p>
            <p><strong>เวลา:</strong> ${store.selectedTime} น.</p>
          </div>
        `,
            });

            if (printResult.isConfirmed) {
                createPrintSlip({
                    date: bookingInfo.date,
                    time: bookingInfo.time,
                    therapist: bookingInfo.therapist,
                    patientId: bookingInfo.patientId,
                    patientFirstName: bookingInfo.patientFirstName,
                    patientLastName: bookingInfo.patientLastName,
                    patientPhone: bookingInfo.patientPhone,
                });
            }

            // A booking has just been completed, so do not stay in next-patient mode.
            store.awaitingNextPatient = false;

            // Keep the first patient's data up to date (important for new patients).
            if (store.bookedInFlow === 0) {
                store.updatePrimaryPatient({
                    patient_id: patientId.value,
                    first_name: trimmedFirstName,
                    last_name: trimmedLastName,
                    phone_number: trimmedPhone,
                    can_self_book: store.currentPatientData?.can_self_book ?? false,
                });
            }

            store.recordCompletedBooking({
                booking_id: `${Date.now()}-${patientId.value}`,
                booking_date: bookingInfo.date,
                booking_time: bookingInfo.time,
                therapist_name: bookingInfo.therapist,
                patient_id: bookingInfo.patientId,
                patient_first_name: bookingInfo.patientFirstName,
                patient_last_name: bookingInfo.patientLastName,
                patient_phone: bookingInfo.patientPhone,
                created_at: new Date().toISOString(),
            });

            // Multi-booking flow:
            if (store.remainingToBook > 1) {
                // decrement remaining count in store
                store.decrementRemainingToBook();

                if (store.remainingToBook > 0) {
                    // After one person is booked, ask for the next person's ID card
                    // before selecting a time slot for them.
                    await Swal.fire({
                        icon: "info",
                        title: "กรอกเลขบัตรของผู้เข้ารับบริการคนถัดไป",
                        html: `คงเหลืออีก <strong>${store.remainingToBook}</strong> คน<br>ระบบจะพากลับไปยังหน้าค้นหาผู้ป่วยเพื่อระบุตัวตนของคนถัดไป`,
                        timer: 2000,
                        showConfirmButton: false,
                    });

                    // Clear current patient data so the next person can be identified
                    store.currentPatientData = null;
                    store.selectedTime = "";
                    store.selectedTherapist = "";
                    store.awaitingNextPatient = true;

                    // Keep selectedDate and filters. Go back to the ID search step first.
                    store.navigateTo("booking-start");

                    // Stop here; after the next person is chosen the flow continues to slots.
                    return;
                } else {
                    // Completed all people → return to the calendar with the original patient
                    try {
                        store.currentDate = new Date(store.selectedDate);
                    } catch (e) {
                        // ignore invalid date parsing
                    }
                    store.restorePrimaryPatient();
                    store.navigateTo("calendar");
                }
            } else {
                // Single/final booking → return to calendar with the original patient,
                // preserving filters and the selected month.
                try {
                    store.currentDate = new Date(store.selectedDate);
                } catch (e) {
                    // ignore
                }
                store.restorePrimaryPatient();
                store.navigateTo("calendar");
            }
        } else {
            Swal.fire(
                "จองไม่สำเร็จ",
                res?.message || "กรุณาลองใหม่อีกครั้ง",
                "error",
            );
        }
    } catch (err) {
        const e = err as Error;
        Swal.fire("เกิดข้อผิดพลาด", `ระบบขัดข้อง: ${e.message || ""}`, "error");
    } finally {
        isSubmitting.value = false;
    }
}
</script>

<template>
    <div id="booking-form-view">
        <!-- Page Title -->
        <h2 class="page-title">
            <i class="fa-solid fa-pen-to-square"></i>ยืนยันการจองคิว
        </h2>

        <!-- Appointment Summary -->
        <div class="booking-summary">
            <p class="summary-item">
                <i class="fa-solid fa-user-doctor"></i>
                <strong>ชื่อหมอ:</strong> {{ store.selectedTherapist }}
            </p>
            <p class="summary-item">
                <i class="fa-solid fa-calendar-day"></i>
                <strong>วันที่นัด:</strong>
                {{ formatThaiDate(store.selectedDate) }}
            </p>
            <p class="summary-item">
                <i class="fa-solid fa-clock"></i>
                <strong>เวลา:</strong> {{ store.selectedTime }} น.
            </p>
            <p v-if="store.remainingToBook > 1" class="summary-item">
                <i class="fa-solid fa-users"></i>
                <strong>ผู้เข้ารับบริการที่เหลือ:</strong>
                {{ store.remainingToBook }} คน
            </p>
        </div>

        <!-- Booking Form -->
        <form id="booking-form" novalidate @submit="handleSubmit">
            <!-- Patient ID -->
            <div class="form-group">
                <label for="patientId">เลขบัตรประชาชน</label>
                <input
                    id="patientId"
                    v-model="patientId"
                    type="tel"
                    required
                    inputmode="numeric"
                    maxlength="13"
                    :readonly="isRegisteredPatient"
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
                    :disabled="isSubmitting"
                />
            </div>

            <p v-if="isRegisteredPatient" class="patient-data-note">
                <i class="fa-solid fa-circle-info"></i>
                แก้ไขข้อมูลได้ เมื่อยืนยันการจอง ระบบจะอัปเดตทะเบียนผู้ป่วย
                และรายการจองเดิมให้ตรงกับข้อมูลล่าสุด
            </p>

            <!-- PDPA Consent -->
            <div class="pdpa-consent-container">
                <div class="pdpa-checkbox-group">
                    <input
                        id="pdpa-consent"
                        v-model="pdpaConsented"
                        type="checkbox"
                        :disabled="isSubmitting"
                    />
                    <label for="pdpa-consent" class="pdpa-text">
                        ข้าพเจ้ายินยอมให้โรงพยาบาลสระโบสถ์เก็บรวบรวมและใช้ข้อมูลส่วนบุคคลของข้าพเจ้า
                        เพื่อวัตถุประสงค์ในการให้บริการทางการแพทย์ &nbsp;<a
                            href="#"
                            @click.prevent="showPdpaModal = true"
                            >อ่านนโยบายความเป็นส่วนตัว</a
                        >
                    </label>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="btn-action-group">
                <button
                    id="back-to-slots"
                    type="button"
                    class="btn btn-secondary"
                    :disabled="isSubmitting"
                    @click="goBack"
                >
                    <i class="fa-solid fa-arrow-left"></i> กลับ
                </button>
                <button
                    id="submit-booking-btn"
                    type="submit"
                    class="btn"
                    :disabled="!pdpaConsented || isSubmitting"
                >
                    <i v-if="isSubmitting" class="fas fa-spinner fa-spin"></i>
                    <i v-else class="fa-solid fa-calendar-check"></i>
                    {{ isSubmitting ? "กำลังบันทึก..." : "ยืนยันการจอง" }}
                </button>
            </div>
        </form>

        <!-- PDPA Modal (Teleport to body) -->
        <Teleport to="body">
            <div
                v-if="showPdpaModal"
                class="modal-overlay"
                @click.self="showPdpaModal = false"
            >
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>
                            <i class="fa-solid fa-shield-halved"></i>
                            นโยบายความเป็นส่วนตัว
                        </h2>
                        <button
                            class="modal-close-btn"
                            @click="showPdpaModal = false"
                        >
                            &times;
                        </button>
                    </div>
                    <div class="modal-body">
                        <p>
                            โรงพยาบาลสระโบถ์ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของท่าน
                            ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
                            (PDPA)
                        </p>

                        <h4>1. ข้อมูลที่เราเก็บรวบรวม</h4>
                        <ul>
                            <li>ชื่อ-นามสกุล และเลขบัตรประชาชน</li>
                            <li>หมายเลขโทรศัพท์ติดต่อ</li>
                            <li>ข้อมูลการนัดหมายและบริการที่ได้รับ</li>
                        </ul>

                        <h4>2. วัตถุประสงค์ในการใช้ข้อมูล</h4>
                        <ul>
                            <li>
                                เพื่อจัดการนัดหมายและการให้บริการทางการแพทย์
                            </li>
                            <li>เพื่อการสื่อสารและแจ้งเตือนนัดหมาย</li>
                            <li>เพื่อการพัฒนาคุณภาพการให้บริการ</li>
                        </ul>

                        <h4>3. การเปิดเผยข้อมูล</h4>
                        <p>
                            ข้อมูลของท่านจะถูกเก็บรักษาเป็นความลับ
                            และจะไม่ถูกเปิดเผยต่อบุคคลภายนอก
                            ยกเว้นกรณีที่จำเป็นตามกฎหมายหรือการให้บริการทางการแพทย์
                        </p>

                        <h4>4. สิทธิ์ของเจ้าของข้อมูล</h4>
                        <ul>
                            <li>สิทธิ์ในการเข้าถึงและขอสำเนาข้อมูลส่วนบุคคล</li>
                            <li>สิทธิ์ในการขอแก้ไขข้อมูลที่ไม่ถูกต้อง</li>
                            <li>สิทธิ์ในการขอลบหรือทำลายข้อมูล</li>
                            <li>สิทธิ์ในการคัดค้านการประมวลผลข้อมูล</li>
                        </ul>

                        <h4>5. การติดต่อ</h4>
                        <p>
                            หากท่านมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว
                            กรุณาติดต่อ<br />
                            งานแพทย์แผนไทย โรงพยาบาลสระโบสถ์<br />
                            โทร: 082-202-9667 (ในวันเวลาราชการ)
                        </p>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
