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
      <div className="text-right p-4 text-red-600 text-sm sm:text-base">
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
      <div className="text-right p-4 text-red-600 text-sm sm:text-base">
        خطأ: لا توجد تقارير صالحة للعرض
      </div>
    );
  }

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
        absence: report.absence === 'نعم',
        annualLeave: report.annualLeave === 'نعم',
        medicalLeave: report.medicalLeave === 'نعم',
        officialLeave: report.officialLeave === 'نعم',
        leaveCompensation: report.leaveCompensation === 'لا' ? 0 : Number(report.leaveCompensation) || 0,
      };
      console.log('Formatted report for EditModal:', formattedReport);
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

  // حساب الإجماليات
  const totals = validReports.reduce(
    (acc, report) => {
      try {
        acc.totalWorkHours += Number(report.workHours) || 0;
        acc.totalWorkDays += report.absence === 'لا' &&
                             (Number(report.weeklyLeaveDays) || 0) === 0 &&
                             report.annualLeave === 'لا' &&
                             report.medicalLeave === 'لا' &&
                             report.officialLeave === 'لا' &&
                             (Number(report.leaveCompensation) || 0) === 0 ? 1 : 0;
        acc.totalAbsenceDays += report.absence === 'نعم' ? 1 : 0;
        acc.totalLateDays += (Number(report.lateDeduction) || 0) > 0 ? 1 : 0;
        acc.totalDeductions += (Number(report.lateDeduction) || 0) +
                              (Number(report.earlyLeaveDeduction) || 0) +
                              (Number(report.medicalLeaveDeduction) || 0);
        acc.totalOvertime += Number(report.overtime) || 0;
        acc.totalWeeklyLeaveDays += Number(report.weeklyLeaveDays) || 0;
        acc.totalAnnualLeaveDays += report.annualLeave === 'نعم' ? 1 : 0;
        acc.totalMedicalLeaveDays += report.medicalLeave === 'نعم' ? 1 : 0;
        acc.totalOfficialLeaveDays += report.officialLeave === 'نعم' ? 1 : 0;
        acc.totalLeaveCompensationDays += (Number(report.leaveCompensation) || 0) > 0 ? 1 : 0;
        acc.totalLeaveCompensationValue += Number(report.leaveCompensation) || 0;
        acc.totalAnnualLeaveBalance += Number(report.annualLeaveBalance) || 0;
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
    }
  );

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4 text-right">التقارير</h2>
      {validReports.length === 0 ? (
        <div className="text-right p-4 text-gray-600 text-sm sm:text-base">
          لا توجد تقارير للعرض
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">كود الموظف</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">الاسم</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">التاريخ</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">الحضور</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">الانصراف</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">ساعات العمل</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">الساعات الإضافية</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">دقائق التأخير</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">خصم التأخير</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">خصم الانصراف المبكر</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">الغياب</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">الإجازة السنوية</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">الإجازة الطبية</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">الإجازة الرسمية</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">بدل الإجازة</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">أيام العمل الأسبوعية</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">أيام الإجازة الأسبوعية</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">رصيد السماح بالتأخير</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">رصيد الإجازة السنوية</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-800 border-b">إجراءات</th>
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

                  return (
                    <motion.tr
                      key={report._id}
                      whileHover={{ backgroundColor: '#f1fafb' }}
                      transition={{ duration: 0.2 }}
                      className={
                        report.absence === 'نعم' ? 'bg-red-50' :
                        report.isSingleFingerprint === 'نعم' ? 'bg-yellow-50' :
                        report.annualLeave === 'نعم' ? 'bg-green-50' :
                        report.medicalLeave === 'نعم' ? 'bg-blue-50' :
                        report.officialLeave === 'نعم' ? 'bg-cyan-50' :
                        (Number(report.leaveCompensation) || 0) > 0 ? 'bg-amber-50' : ''
                      }
                    >
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{report.code || '-'}</td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{report.employeeName || '-'}</td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">
                        {reportDate ? reportDate.toFormat('yyyy-MM-dd') : '-'}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">
                        {checkInTime ? checkInTime.toFormat('hh:mm:ss a') : '-'}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">
                        {checkOutTime ? checkOutTime.toFormat('hh:mm:ss a') : '-'}
                      </td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{(Number(report.workHours) || 0).toFixed(2)}</td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{(Number(report.overtime) || 0).toFixed(2)}</td>
	              <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{(Number(report.L_DAY_MINUTES) || 0).toFixed(0)}</td>

                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{(Number(report.lateDeduction) || 0).toFixed(2)}</td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{(Number(report.earlyLeaveDeduction) || 0).toFixed(2)}</td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{report.absence || '-'}</td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{report.annualLeave || '-'}</td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{report.medicalLeave || '-'}</td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{report.officialLeave || '-'}</td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{(Number(report.leaveCompensation) || 0).toFixed(2)}</td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{Number(report.workDaysPerWeek) || '-'}</td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{Number(report.weeklyLeaveDays) || '-'}</td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{report.monthlyLateAllowance !== undefined ? report.monthlyLateAllowance : '-'}</td>
                      <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm">{report.annualLeaveBalance !== undefined ? report.annualLeaveBalance : '-'}</td>
                      <td className="px-2 sm:px-4 py-2 text-right">
                        <motion.button
                          onClick={() => handleEdit(report)}
                          whileHover={{ scale: 1.05, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          whileTap={{ scale: 0.95 }}
                          className="w-full sm:w-auto bg-blue-600 text-white px-3 sm:px-4 py-1 sm:py-1 rounded-md hover:bg-blue-700 transition-colors duration-300 text-xs sm:text-sm"
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
            <div className="flex justify-center mt-4">
              <motion.button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 mx-1 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
              >
                السابق
              </motion.button>
              <span className="px-4 py-2 mx-1 text-sm font-medium text-gray-700">
                الصفحة {currentPage} من {Math.ceil(validReports.length / reportsPerPage)}
              </span>
              <motion.button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={indexOfLastReport >= validReports.length}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 mx-1 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
              >
                التالي
              </motion.button>
            </div>
          )}

          {/* عرض الإجماليات */}
          <div className="mt-6 text-right">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">إجماليات الفترة</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg shadow-inner">
              <div className="bg-blue-100 p-3 sm:p-4 rounded-lg text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي ساعات العمل</p>
                <p className="text-sm sm:text-lg font-bold text-blue-700">{totals.totalWorkHours.toFixed(2)} ساعة</p>
              </div>
              <div className="bg-green-100 p-3 sm:p-4 rounded-lg text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام العمل</p>
                <p className="text-sm sm:text-lg font-bold text-green-700">{totals.totalWorkDays} يوم</p>
              </div>
              <div className="bg-red-100 p-3 sm:p-4 rounded-lg text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام الغياب</p>
                <p className="text-sm sm:text-lg font-bold text-red-700">{totals.totalAbsenceDays} يوم</p>
              </div>
              <div className="bg-orange-100 p-3 sm:p-4 rounded-lg text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام التأخير</p>
                <p className="text-sm sm:text-lg font-bold text-orange-700">{totals.totalLateDays} يوم</p>
              </div>
              <div className="bg-yellow-100 p-3 sm:p-4 rounded-lg text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي الخصومات</p>
                <p className="text-sm sm:text-lg font-bold text-yellow-700">{totals.totalDeductions.toFixed(2)} يوم</p>
              </div>
              <div className="bg-purple-100 p-3 sm:p-4 rounded-lg text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي الساعات الإضافية</p>
                <p className="text-sm sm:text-lg font-bold text-purple-700">{totals.totalOvertime.toFixed(2)} ساعة</p>
              </div>
              <div className="bg-indigo-100 p-3 sm:p-4 rounded-lg text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام الإجازة الأسبوعية</p>
                <p className="text-sm sm:text-lg font-bold text-indigo-700">{totals.totalWeeklyLeaveDays} يوم</p>
              </div>
              <div className="bg-teal-100 p-3 sm:p-4 rounded-lg text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام الإجازة السنوية</p>
                <p className="text-sm sm:text-lg font-bold text-teal-700">{totals.totalAnnualLeaveDays} يوم</p>
              </div>
              <div className="bg-pink-100 p-3 sm:p-4 rounded-lg text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام الإجازة الطبية</p>
                <p className="text-sm sm:text-lg font-bold text-pink-700">{totals.totalMedicalLeaveDays} يوم</p>
              </div>
              <div className="bg-cyan-100 p-3 sm:p-4 rounded-lg text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام الإجازة الرسمية</p>
                <p className="text-sm sm:text-lg font-bold text-cyan-700">{totals.totalOfficialLeaveDays} يوم</p>
              </div>
              <div className="bg-amber-100 p-3 sm:p-4 rounded-lg text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام بدل الإجازة</p>
                <p className="text-sm sm:text-lg font-bold text-amber-700">{totals.totalLeaveCompensationDays} يوم</p>
              </div>
              <div className="bg-lime-100 p-3 sm:p-4 rounded-lg text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي قيمة بدل الإجازة</p>
                <p className="text-sm sm:text-lg font-bold text-lime-700">{totals.totalLeaveCompensationValue.toFixed(2)} جنيه</p>
              </div>
              <div className="bg-gray-100 p-3 sm:p-4 rounded-lg text-right">
                <p className="text-xs sm:text-sm font-medium text-gray-600">رصيد الإجازات السنوية</p>
                <p className="text-sm sm:text-lg font-bold text-gray-700">{totals.totalAnnualLeaveBalance.toFixed(2)} يوم</p>
              </div>
            </div>
          </div>

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
