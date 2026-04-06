// =====================================================================
//  Validators - ฟังก์ชันตรวจสอบข้อมูล
// =====================================================================

/**
 * ตรวจสอบเลขบัตรประชาชนไทย 13 หลัก (Luhn-like checksum)
 */
export function validateThaiId(id: string): boolean {
  if (!id || id.length !== 13 || !/^[0-9]\d+$/.test(id)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(id.charAt(i)) * (13 - i)
  }
  const check = (11 - (sum % 11)) % 10
  return check === parseInt(id.charAt(12))
}

/**
 * ตรวจสอบเบอร์โทรศัพท์ไทย (9-10 หลัก)
 */
export function validateThaiPhone(phone: string): boolean {
  return /^[0-9]{9,10}$/.test(phone)
}
