export function calculateNetWorkingTime(startDate: Date, endDate: Date = new Date()): number {
  if (startDate >= endDate) return 0;

  let totalMilliseconds = 0;
  let currentDate = new Date(startDate);

  while (currentDate < endDate) {
    // خصم يوم الإجازة (بافتراض أن الجمعة هو الإجازة، 5 يعني الجمعة)
    if (currentDate.getDay() === 5) {
      currentDate.setHours(0, 0, 0, 0);
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // مواعيد الفترات لليوم الحالي
    const morningStart = new Date(currentDate);
    morningStart.setHours(8, 0, 0, 0);
    
    const morningEnd = new Date(currentDate);
    morningEnd.setHours(13, 0, 0, 0);

    const afternoonStart = new Date(currentDate);
    afternoonStart.setHours(14, 0, 0, 0);

    const afternoonEnd = new Date(currentDate);
    afternoonEnd.setHours(17, 0, 0, 0);

    const nextDay = new Date(currentDate);
    nextDay.setHours(0, 0, 0, 0);
    nextDay.setDate(nextDay.getDate() + 1);

    // حساب التقاطع مع الفترة الصباحية (من 8 لـ 1)
    const mStart = new Date(Math.max(currentDate.getTime(), morningStart.getTime()));
    const mEnd = new Date(Math.min(endDate.getTime(), morningEnd.getTime()));
    if (mStart < mEnd) {
      totalMilliseconds += mEnd.getTime() - mStart.getTime();
    }

    // حساب التقاطع مع الفترة المسائية (من 2 لـ 5)
    const aStart = new Date(Math.max(currentDate.getTime(), afternoonStart.getTime()));
    const aEnd = new Date(Math.min(endDate.getTime(), afternoonEnd.getTime()));
    if (aStart < aEnd) {
      totalMilliseconds += aEnd.getTime() - aStart.getTime();
    }

    // الانتقال لليوم التالي
    currentDate = nextDay;
  }

  // تحويل الميلي ثانية إلى ساعات
  return totalMilliseconds / (1000 * 60 * 60);
}

export function formatDuration(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    if (h === 0) return `${m} دقيقة`;
    return `${h} ساعة و ${m} دقيقة`;
}
