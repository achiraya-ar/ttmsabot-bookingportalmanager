// =====================================================================
//  Print Utility Functions สำหรับระบบจองคิวแพทย์แผนไทย
//  โครงสร้าง HTML ตรงกับต้นฉบับ 100%
// =====================================================================

import { formatThaiDate } from "./dateUtils";
import type { Booking, BookingInfo } from "@/types";

/**
 * พิมพ์ใบนัดหมายสำหรับการจอง 1 รายการ
 * โครงสร้าง HTML ตรงกับ createPrintSlip() ต้นฉบับ
 */
export function createPrintSlip(booking: Booking | BookingInfo): void {
  const firstName =
    "patient_first_name" in booking
      ? booking.patient_first_name
      : booking.patientFirstName;
  const lastName =
    "patient_last_name" in booking
      ? booking.patient_last_name
      : booking.patientLastName;
  const phone =
    "patient_phone" in booking ? booking.patient_phone : booking.patientPhone;
  const therapist =
    "therapist_name" in booking ? booking.therapist_name : booking.therapist;
  const date = "booking_date" in booking ? booking.booking_date : booking.date;
  const time = "booking_time" in booking ? booking.booking_time : booking.time;

  const printContentHtml =
    `<div class="slip-container">` +
    `<div class="slip-header">` +
    `<h2>ใบนัดหมาย</h2>` +
    `<p>งานแพทย์แผนไทย โรงพยาบาลสระโบสถ์</p>` +
    `</div>` +
    `<div class="slip-section">` +
    `<h3>ข้อมูลผู้ป่วย</h3>` +
    `<p><strong>ชื่อ-นามสกุล:</strong> ${firstName} ${lastName}</p>` +
    `<p><strong>เบอร์โทร:</strong> ${phone || "-"}</p>` +
    `</div>` +
    `<div class="slip-section">` +
    `<h3>ข้อมูลการนัดหมาย</h3>` +
    `<p><strong>ชื่อหมอ:</strong> ${therapist}</p>` +
    `<p><strong>วันที่:</strong> ${formatThaiDate(date)}</p>` +
    `<p><strong>เวลา:</strong> ${time.slice(0, 5)} น.</p>` +
    `</div>` +
    `<div class="slip-footer">` +
    `<p>กรุณามาถึงก่อนเวลานัดหมายและแสดงใบนัดหมายแก่เจ้าหน้าที่<br>กรณีมาล่าช้ากว่ากำหนด ขอความกรุณาท่านทำการจองนัดหมายใหม่</p>` +
    `<p class="contact-info">ติดต่อ งานแพทย์แผนไทย: 082-202-9667 (ในวันเวลาราชการ)</p>` +
    `</div>` +
    `</div>`;

  triggerPrint(printContentHtml);
}

/**
 * พิมพ์ใบนัดหมายรวมทุกรายการของผู้ป่วย
 * โครงสร้าง HTML ตรงกับ createPrintAllSlip() ต้นฉบับ
 */
export function createPrintAllSlip(bookings: Booking[]): void {
  if (!bookings || bookings.length === 0) return;

  const firstBooking = bookings[0];

  const bookingRowsHtml = bookings
    .map(
      (booking) =>
        `<tr>` +
        `<td>${formatThaiDate(booking.booking_date, false)}</td>` +
        `<td>${booking.booking_time.slice(0, 5)} น.</td>` +
        `<td>${booking.therapist_name}</td>` +
        `</tr>`,
    )
    .join("");

  const printContentHtml =
    `<div class="slip-container">` +
    `<div class="slip-header">` +
    `<h2>ใบนัดหมาย (รวมทุกรายการ)</h2>` +
    `<p>งานแพทย์แผนไทย โรงพยาบาลสระโบสถ์</p>` +
    `</div>` +
    `<div class="slip-section">` +
    `<h3>ข้อมูลผู้ป่วย</h3>` +
    `<p><strong>ชื่อ-นามสกุล:</strong> ${firstBooking.patient_first_name} ${firstBooking.patient_last_name}</p>` +
    `<p><strong>เบอร์โทร:</strong> ${firstBooking.patient_phone || "-"}</p>` +
    `</div>` +
    `<div class="slip-section">` +
    `<h3>รายการนัดหมายทั้งหมด (${bookings.length} รายการ)</h3>` +
    `<table class="slip-table">` +
    `<thead>` +
    `<tr><th>วันที่</th><th>เวลา</th><th>ชื่อหมอ</th></tr>` +
    `</thead>` +
    `<tbody>${bookingRowsHtml}</tbody>` +
    `</table>` +
    `</div>` +
    `<div class="slip-footer">` +
    `<p>กรุณามาถึงก่อนเวลานัดหมายและแสดงใบนัดหมายแก่เจ้าหน้าที่<br>กรณีมาล่าช้ากว่ากำหนด ขอความกรุณาท่านทำการจองนัดหมายใหม่</p>` +
    `<p class="contact-info">ติดต่อ งานแพทย์แผนไทย: 082-202-9667 (ในวันเวลาราชการ)</p>` +
    `</div>` +
    `</div>`;

  triggerPrint(printContentHtml);
}

/**
 * สร้าง DOM element สำหรับ print และเรียก window.print()
 * ลบ element ออกหลังจาก print dialog ปิด (ใช้ afterprint event)
 */
function triggerPrint(htmlContent: string): void {
  // ลบ element เก่าถ้ายังค้างอยู่
  const existingEl = document.getElementById(
    "appointment-slip-print-container",
  );
  if (existingEl) {
    document.body.removeChild(existingEl);
  }

  const printElement = document.createElement("div");
  printElement.id = "appointment-slip-print-container";
  printElement.innerHTML = htmlContent;
  document.body.appendChild(printElement);

  // เรียก print (synchronous - blocks จนกว่า dialog จะปิด)
  window.print();

  // ลบ element หลัง print dialog ปิด
  // ใช้ afterprint event เป็นหลัก + setTimeout เป็น fallback
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    const el = document.getElementById("appointment-slip-print-container");
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  // fallback: ลบหลัง 5 วินาที กรณี afterprint ไม่ fire ใน browser เก่า
  setTimeout(cleanup, 5000);
}
