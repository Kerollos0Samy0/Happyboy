export function calculateEffectiveWorkingSeconds(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  
  if (start >= end) return 0;

  // Working shifts: 08:00 to 13:00, 14:00 to 17:00
  const shifts = [
    { startHour: 8, endHour: 13 },
    { startHour: 14, endHour: 17 }
  ];

  let totalWorkingSeconds = 0;
  
  const currentDate = new Date(startStr);
  currentDate.setHours(0, 0, 0, 0);

  const endDay = new Date(endStr);
  endDay.setHours(23, 59, 59, 999);

  while (currentDate.getTime() < endDay.getTime()) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = currentDate.getDate();

    for (const shift of shifts) {
      const shiftStart = new Date(year, month, date, shift.startHour, 0, 0).getTime();
      const shiftEnd = new Date(year, month, date, shift.endHour, 0, 0).getTime();

      const overlapStart = Math.max(start, shiftStart);
      const overlapEnd = Math.min(end, shiftEnd);

      if (overlapEnd > overlapStart) {
        totalWorkingSeconds += Math.floor((overlapEnd - overlapStart) / 1000);
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return totalWorkingSeconds;
}
