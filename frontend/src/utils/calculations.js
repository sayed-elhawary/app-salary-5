import { DateTime } from 'luxon';

// دالة لحساب الإجماليات (تستخدم في كل من الواجهة الأمامية والخلفية)
export const calculateTotals = (reports, workDaysPerWeek = 5) => {
  return reports.reduce(
    (acc, report) => {
      const date = DateTime.fromISO(report.date, { zone: 'Africa/Cairo' });
      const isWeeklyLeave = isWeeklyLeaveDay(date.toJSDate(), workDaysPerWeek);
      const isWorkDay =
        !isWeeklyLeave &&
        report.absence !== 'نعم' &&
        report.annualLeave !== 'نعم' &&
        report.medicalLeave !== 'نعم';

      acc.totalWorkHours += report.workHours || 0;
      acc.totalWorkDays += isWorkDay ? 1 : 0;
      acc.totalAbsenceDays += report.absence === 'نعم' ? 1 : 0;
      acc.totalDeductions +=
        (report.lateDeduction || 0) +
        (report.earlyLeaveDeduction || 0) +
        (report.medicalLeaveDeduction || 0);
      acc.totalOvertime += report.overtime || 0;
      acc.totalWeeklyLeaveDays += isWeeklyLeave ? 1 : 0;
      acc.totalAnnualLeaveDays += report.annualLeave === 'نعم' ? 1 : 0;
      acc.totalMedicalLeaveDays += report.medicalLeave === 'نعم' ? 1 : 0;
      acc.totalLateMinutes += report.lateMinutes || 0;
      acc.annualLeaveBalance = report.annualLeaveBalance || 21;

      return acc;
    },
    {
      totalWorkHours: 0,
      totalWorkDays: 0,
      totalAbsenceDays: 0,
      totalDeductions: 0,
      totalOvertime: 0,
      totalWeeklyLeaveDays: 0,
      totalAnnualLeaveDays: 0,
      totalMedicalLeaveDays: 0,
      totalLateMinutes: 0,
      annualLeaveBalance: 21,
    }
  );
};

// دالة للتحقق من أيام الإجازة الأسبوعية
export const isWeeklyLeaveDay = (date, workDaysPerWeek) => {
  const dayOfWeek = DateTime.fromJSDate(date, { zone: 'Africa/Cairo' }).weekday;
  return (
    (workDaysPerWeek === 5 && (dayOfWeek === 5 || dayOfWeek === 6)) ||
    (workDaysPerWeek === 6 && dayOfWeek === 5)
  );
};

// دالة لحساب أيام الإجازة الأسبوعية في فترة
export const calculateWeeklyLeaveDays = (startDate, endDate, workDaysPerWeek) => {
  let currentDate = DateTime.fromISO(startDate, { zone: 'Africa/Cairo' });
  const end = DateTime.fromISO(endDate, { zone: 'Africa/Cairo' });
  let weeklyLeaveDays = 0;

  while (currentDate <= end) {
    if (isWeeklyLeaveDay(currentDate.toJSDate(), workDaysPerWeek)) {
      weeklyLeaveDays++;
    }
    currentDate = currentDate.plus({ days: 1 });
  }
  return weeklyLeaveDays;
};
