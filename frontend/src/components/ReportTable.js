import React, { useState } from 'react';
import { DateTime } from 'luxon';
import { motion } from 'framer-motion';
import EditModal from './EditModal';

const ReportTable = ({ reports, onEdit }) => {
  const [selectedReport, setSelectedReport] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const reportsPerPage = 10;

  // التحقق من أن reports مصفوفة صالحة
  if (!Array.isArray(reports)) {
    console.error('Reports is not an array:', reports);
    return (
      <div className="text-right p-4 text-red-600 text-sm">
        خطأ: لا توجد بيانات تقارير متاحة أو البيانات غير صالحة
      </div>
    );
  }

  // تصفية التقارير الصالحة
  const validReports = reports.filter(report => {
    if (!report || !report._id) {
      console.warn('Invalid report object:', report);
      return false;
    }
    return true;
  });

  if (validReports.length === 0 && reports.length > 0) {
    console.error('No valid reports with _id found:', reports);
    return (
      <div className="text-right p-4 text-red-600 text-sm">
        خطأ: لا توجد تقارير صالحة للعرض
      </div>
    );
  }

  // التحقق من عدد أكواد المستخدمين المختلفة
  const uniqueCodes = [...new Set(validReports.map(report => report.code))];
  const isSingleUser = uniqueCodes.length === 1;

  // حساب التقارير للصفحة الحالية
  const indexOfLastReport = currentPage * reportsPerPage;
  const indexOfFirstReport = indexOfLastReport - reportsPerPage;
  const currentReports = validReports.slice(indexOfFirstReport, indexOfLastReport);

  // التعامل مع زر التعديل
  const handleEdit = (report) => {
    try {
      if (!report || !report._id) {
        console.error('Invalid report for editing:', report);
        return;
      }

      const formattedReport = {
        ...report,
        date: report.date && DateTime.fromISO(report.date, { zone: 'Africa/Cairo' }).isValid
          ? DateTime.fromISO(report.date, { zone: 'Africa/Cairo' }).toFormat('yyyy-MM-dd')
          : '',
        checkIn: report.checkIn && DateTime.fromFormat(report.checkIn, 'hh:mm:ss a', { zone: 'Africa/Cairo' }).isValid
          ? DateTime.fromFormat(report.checkIn, 'hh:mm:ss a', { zone: 'Africa/Cairo' }).toFormat('HH:mm:ss')
          : '',
        checkOut: report.checkOut && DateTime.fromFormat(report.checkOut, 'hh:mm:ss a', { zone: 'Africa/Cairo' }).isValid
          ? DateTime.fromFormat(report.checkOut, 'hh:mm:ss a', { zone: 'Africa/Cairo' }).toFormat('HH:mm:ss')
          : '',
        absence: report.absence === 'نعم' || report.absence === true,
        annualLeave: report.annualLeave === 'نعم' || report.annualLeave === true,
        medicalLeave: report.medicalLeave === 'نعم' || report.medicalLeave === true,
        officialLeave: report.officialLeave === 'نعم' || report.officialLeave === true,
        leaveCompensation: report.leaveCompensation === 'لا' ? 0 : Number(report.leaveCompensation) || 0,
      };
      setSelectedReport(formattedReport);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error formatting report for edit:', error, 'Report:', report);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedReport(null);
  };

  const handleReportUpdate = (updatedReport) => {
    try {
      if (!updatedReport || !updatedReport._id) {
        console.error('Invalid updated report:', updatedReport);
        return;
      }
      onEdit(updatedReport);
      setIsModalOpen(false);
      setSelectedReport(null);
    } catch (error) {
      console.error('Error updating report:', error, 'Updated Report:', updatedReport);
    }
  };

  // حساب رصيد السماح المتبقي لكل تقرير
  const calculateRemainingLateAllowance = (report, reportsForUser) => {
    const monthlyLateAllowance = Number(report.monthlyLateAllowance) || 120; // القيمة الافتراضية
    const totalLateMinutes = reportsForUser
      .filter(r => DateTime.fromISO(r.date, { zone: 'Africa/Cairo' }).toISODate() <= DateTime.fromISO(report.date, { zone: 'Africa/Cairo' }).toISODate())
      .reduce((acc, r) => acc + (Number(r.lateMinutes) || 0), 0);
    const remaining = Math.max(0, monthlyLateAllowance - totalLateMinutes);
    console.log(`Calculating remainingLateAllowance for ${report.code} on ${report.date}: monthlyLateAllowance=${monthlyLateAllowance}, totalLateMinutes=${totalLateMinutes}, remaining=${remaining}`);
    return remaining;
  };

  // حساب الإجماليات (فقط إذا كان البحث لمستخدم واحد)
  const totals = isSingleUser
    ? validReports.reduce(
        (acc, report) => {
          try {
            acc.totalWorkHours += Number(report.workHours) || 0;
            acc.totalWorkDays += report.absence === 'لا' &&
                                 (Number(report.weeklyLeaveDays) || 0) === 0 &&
                                 report.annualLeave === 'لا' &&
                                 report.medicalLeave === 'لا' &&
                                 report.officialLeave === 'لا' &&
                                 (Number(report.leaveCompensation) || 0) === 0 ? 1 : 0;
            acc.totalAbsenceDays += report.absence === 'نعم' || report.absence === true ? 1 : 0;
            acc.totalLateDays += (Number(report.lateDeduction) || 0) > 0 ? 1 : 0;
            acc.totalDeductions += (Number(report.lateDeduction) || 0) +
                                  (Number(report.earlyLeaveDeduction) || 0) +
                                  (Number(report.medicalLeaveDeduction) || 0);
            acc.totalOvertime += Number(report.overtime) || 0;
            acc.totalWeeklyLeaveDays += Number(report.weeklyLeaveDays) || 0;
            acc.totalAnnualLeaveDays += report.annualLeave === 'نعم' || report.annualLeave === true ? 1 : 0;
            acc.totalMedicalLeaveDays += report.medicalLeave === 'نعم' || report.medicalLeave === true ? 1 : 0;
            acc.totalOfficialLeaveDays += report.officialLeave === 'نعم' || report.officialLeave === true ? 1 : 0;
            acc.totalLeaveCompensationDays += (Number(report.leaveCompensation) || 0) > 0 ? 1 : 0;
            acc.totalLeaveCompensationValue += Number(report.leaveCompensation) || 0;
            acc.totalAnnualLeaveBalance = Number(report.annualLeaveBalance) || 0;
            acc.totalLateMinutes += Number(report.lateMinutes) || 0;
            acc.totalMonthlyLateAllowance = Number(report.monthlyLateAllowance) || 120;
          } catch (error) {
            console.warn('Error processing report for totals:', error, 'Report:', report);
          }
          return acc;
        },
        {
          totalWorkHours: 0,
          totalWorkDays: 0,
          totalAbsenceDays: 0,
          totalLateDays: 0,
          totalDeductions: 0,
          totalOvertime: 0,
          totalWeeklyLeaveDays: 0,
          totalAnnualLeaveDays: 0,
          totalMedicalLeaveDays: 0,
          totalOfficialLeaveDays: 0,
          totalLeaveCompensationDays: 0,
          totalLeaveCompensationValue: 0,
          totalAnnualLeaveBalance: 0,
          totalLateMinutes: 0,
          totalMonthlyLateAllowance: 0,
        }
      )
    : null;

  // حساب رصيد السماح المتبقي للإجماليات
  const totalRemainingLateAllowance = isSingleUser
    ? Math.max(0, totals.totalMonthlyLateAllowance - totals.totalLateMinutes)
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 font-amiri">
      <h2 className="text-xl font-bold text-gray-900 mb-4 text-right">التقارير</h2>
      {validReports.length === 0 ? (
        <div className="text-right p-4 text-gray-600 text-sm">
          لا توجد تقارير للعرض
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">كود الموظف</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">الاسم</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">التاريخ</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">الحضور</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">الانصراف</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">ساعات العمل</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">الساعات الإضافية</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">دقائق التأخير</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">خصم التأخير</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">خصم الانصراف المبكر</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">الغياب</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">الإجازة السنوية</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">الإجازة الطبية</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">الإجازة الرسمية</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">بدل الإجازة</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">أيام العمل الأسبوعية</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">أيام الإجازة الأسبوعية</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">رصيد السماح المتبقي (دقائق)</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">رصيد الإجازة السنوية</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b border-gray-200">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {currentReports.map((report) => {
                  const reportDate = report.date && DateTime.fromISO(report.date, { zone: 'Africa/Cairo' }).isValid
                    ? DateTime.fromISO(report.date, { zone: 'Africa/Cairo' })
                    : null;
                  const checkInTime = report.checkIn && DateTime.fromFormat(report.checkIn, 'hh:mm:ss a', { zone: 'Africa/Cairo' }).isValid
                    ? DateTime.fromFormat(report.checkIn, 'hh:mm:ss a', { zone: 'Africa/Cairo' })
                    : null;
                  const checkOutTime = report.checkOut && DateTime.fromFormat(report.checkOut, 'hh:mm:ss a', { zone: 'Africa/Cairo' }).isValid
                    ? DateTime.fromFormat(report.checkOut, 'hh:mm:ss a', { zone: 'Africa/Cairo' })
                    : null;

                  // تصفية التقارير للموظف الحالي
                  const reportsForUser = validReports.filter(r => r.code === report.code);
                  const remainingLateAllowance = calculateRemainingLateAllowance(report, reportsForUser);

                  return (
                    <motion.tr
                      key={report._id}
                      whileHover={{ backgroundColor: '#e6f7fa' }}
                      transition={{ duration: 0.2 }}
                      className={
                        (report.absence === 'نعم' || report.absence === true) ? 'bg-red-50' :
                        (report.isSingleFingerprint === 'نعم' || report.isSingleFingerprint === true) ? 'bg-yellow-50' :
                        (report.annualLeave === 'نعم' || report.annualLeave === true) ? 'bg-green-50' :
                        (report.medicalLeave === 'نعم' || report.medicalLeave === true) ? 'bg-blue-50' :
                        (report.officialLeave === 'نعم' || report.officialLeave === true) ? 'bg-cyan-50' :
                        (Number(report.leaveCompensation) || 0) > 0 ? 'bg-amber-50' : ''
                      }
                    >
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{report.code || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{report.employeeName || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {reportDate ? reportDate.toFormat('yyyy-MM-dd') : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {checkInTime ? checkInTime.toFormat('hh:mm:ss a') : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {checkOutTime ? checkOutTime.toFormat('hh:mm:ss a') : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{(Number(report.workHours) || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{(Number(report.overtime) || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{(Number(report.lateMinutes) || 0).toFixed(0)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{(Number(report.lateDeduction) || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{(Number(report.earlyLeaveDeduction) || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{report.absence === true || report.absence === 'نعم' ? 'نعم' : 'لا'}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{report.annualLeave === true || report.annualLeave === 'نعم' ? 'نعم' : 'لا'}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{report.medicalLeave === true || report.medicalLeave === 'نعم' ? 'نعم' : 'لا'}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{report.officialLeave === true || report.officialLeave === 'نعم' ? 'نعم' : 'لا'}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{(Number(report.leaveCompensation) || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{Number(report.workDaysPerWeek) || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{Number(report.weeklyLeaveDays) || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{remainingLateAllowance.toFixed(0)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{report.annualLeaveBalance !== undefined ? Number(report.annualLeaveBalance).toFixed(0) : '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <motion.button
                          onClick={() => handleEdit(report)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="px-4 py-2 bg-teal-500 text-white rounded-md text-sm font-medium hover:bg-teal-600 transition-all"
                        >
                          تعديل
                        </motion.button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* أزرار التصفح */}
          {validReports.length > reportsPerPage && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <motion.button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 bg-teal-500 text-white rounded-md text-sm font-medium hover:bg-teal-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                السابق
              </motion.button>
              <span className="px-4 py-2 text-sm font-medium text-gray-700">
                الصفحة {currentPage} من {Math.ceil(validReports.length / reportsPerPage)}
              </span>
              <motion.button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={indexOfLastReport >= validReports.length}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 bg-teal-500 text-white rounded-md text-sm font-medium hover:bg-teal-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                التالي
              </motion.button>
            </div>
          )}

          {/* عرض الإجماليات (فقط لمستخدم واحد) */}
          {isSingleUser && totals && (
            <div className="mt-6 text-right">
              <h3 className="text-lg font-bold text-gray-900 mb-4">إجماليات الفترة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="bg-blue-50 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">إجمالي ساعات العمل</p>
                  <p className="text-lg font-bold text-blue-700">{totals.totalWorkHours.toFixed(2)} ساعة</p>
                </div>
                <div className="bg-green-50 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">إجمالي أيام العمل</p>
                  <p className="text-lg font-bold text-green-700">{totals.totalWorkDays} يوم</p>
                </div>
                <div className="bg-red-50 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">إجمالي أيام الغياب</p>
                  <p className="text-lg font-bold text-red-700">{totals.totalAbsenceDays} يوم</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">إجمالي أيام التأخير</p>
                  <p className="text-lg font-bold text-orange-700">{totals.totalLateDays} يوم</p>
                </div>
                <div className="bg-yellow-50 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">إجمالي الخصومات</p>
                  <p className="text-lg font-bold text-yellow-700">{totals.totalDeductions.toFixed(2)} يوم</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">إجمالي الساعات الإضافية</p>
                  <p className="text-lg font-bold text-purple-700">{totals.totalOvertime.toFixed(2)} ساعة</p>
                </div>
                <div className="bg-indigo-50 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">إجمالي أيام الإجازة الأسبوعية</p>
                  <p className="text-lg font-bold text-indigo-700">{totals.totalWeeklyLeaveDays} يوم</p>
                </div>
                <div className="bg-teal-50 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">إجمالي أيام الإجازة السنوية</p>
                  <p className="text-lg font-bold text-teal-700">{totals.totalAnnualLeaveDays} يوم</p>
                </div>
                <div className="bg-pink-50 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">إجمالي أيام الإجازة الطبية</p>
                  <p className="text-lg font-bold text-pink-700">{totals.totalMedicalLeaveDays} يوم</p>
                </div>
                <div className="bg-cyan-50 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">إجمالي أيام الإجازة الرسمية</p>
                  <p className="text-lg font-bold text-cyan-700">{totals.totalOfficialLeaveDays} يوم</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">إجمالي أيام بدل الإجازة</p>
                  <p className="text-lg font-bold text-amber-700">{totals.totalLeaveCompensationDays} يوم</p>
                </div>
                <div className="bg-lime-50 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">إجمالي قيمة بدل الإجازة</p>
                  <p className="text-lg font-bold text-lime-700">{totals.totalLeaveCompensationValue.toFixed(2)} جنيه</p>
                </div>
                <div className="bg-gray-100 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">رصيد الإجازات السنوية</p>
                  <p className="text-lg font-bold text-gray-700">{totals.totalAnnualLeaveBalance.toFixed(0)} يوم</p>
                </div>
                <div className="bg-gray-200 p-3 rounded-md text-right">
                  <p className="text-sm font-medium text-gray-600">رصيد السماح المتبقي (دقائق)</p>
                  <p className="text-lg font-bold text-gray-700">{totalRemainingLateAllowance.toFixed(0)} دقيقة</p>
                </div>
              </div>
            </div>
          )}

          {/* نافذة التعديل */}
          <EditModal
            report={selectedReport}
            isOpen={isModalOpen}
            onClose={handleModalClose}
            onUpdate={handleReportUpdate}
          />
        </>
      )}
    </div>
  );
};

export default ReportTable;
