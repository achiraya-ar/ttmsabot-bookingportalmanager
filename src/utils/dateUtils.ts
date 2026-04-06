// =====================================================================
//  Date & Number Utility Functions
// =====================================================================

/**
 * แปลงวันที่เป็น string รูปแบบ YYYY-MM-DD
 */
export function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * แปลง dateString (YYYY-MM-DD) เป็นวันที่ภาษาไทย พ.ศ.
 * @param dateString - วันที่ในรูปแบบ YYYY-MM-DD
 * @param withWeekday - แสดงชื่อวันหรือไม่ (default: true)
 */
export function formatThaiDate(dateString: string, withWeekday = true): string {
  if (!dateString) return ''
  const date = new Date(dateString + 'T00:00:00')
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Bangkok',
  }
  if (withWeekday) {
    options.weekday = 'long'
  }
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', options).format(date)
}

/**
 * แสดงเดือน/ปี ภาษาไทย พ.ศ.
 */
export function formatThaiMonthYear(date: Date): string {
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/**
 * Animate counter จาก 0 ไปยัง targetNumber
 */
export function animateCounter(element: HTMLElement, targetNumber: number): void {
  if (isNaN(targetNumber) || targetNumber === null) {
    element.textContent = 'N/A'
    return
  }
  const duration = 1500
  const startNumber = 0
  const startTime = performance.now()

  function update(currentTime: number) {
    const elapsedTime = currentTime - startTime
    const progress = Math.min(elapsedTime / duration, 1)
    const currentNumber = Math.floor(
      progress * (targetNumber - startNumber) + startNumber,
    )
    element.textContent = currentNumber.toLocaleString('en-US')
    if (progress < 1) {
      requestAnimationFrame(update)
    } else {
      element.textContent = targetNumber.toLocaleString('en-US')
    }
  }
  requestAnimationFrame(update)
}
