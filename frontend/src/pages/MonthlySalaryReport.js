import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../components/AuthProvider';
import NavBar from '../components/NavBar';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { DateTime } from 'luxon';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, TextRun, ShadingType } from 'docx';
import { saveAs } from 'file-saver';
import { XIcon } from 'lucide-react';

const SuccessCheckmark = ({ onComplete }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1, transition: { duration: 0.5 } }}
      exit={{ opacity: 0, scale: 0.5 }}
      onAnimationComplete={onComplete}
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
    >
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          transition: { duration: 1.5, repeat: Infinity, repeatType: 'loop' },
        }}
        className="bg-gradient-to-br from-green-600 to-emerald-500 p-6 rounded-full shadow-lg w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center"
      >
        <svg className="w-12 h-12 sm:w-16 sm:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <motion.path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
            d="M5 13l4 4L19 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1, transition: { duration: 0.8 } }}
          />
        </svg>
      </motion.div>
    </motion.div>
  );
};

const LoadingSpinner = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50"
  >
    <div className="relative">
      <motion.div
        className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-t-transparent border-sky-400 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-gray-200 text-sm sm:text-base font-amiri">
        جارٍ التحميل...
      </span>
    </div>
  </motion.div>
);

const MonthlySalaryReport = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [searchCode, setSearchCode] = useState(user?.role !== 'admin' ? user?.code || '' : '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [salaryReports, setSalaryReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else if (user.role !== 'admin') {
      setSearchCode(user.code || '');
    }
  }, [user, navigate]);

  const normalizeDays = (report) => {
    const totalDays =
      (parseInt(report.totalWorkDays, 10) || 0) +
      (parseInt(report.totalAbsenceDays, 10) || 0) +
      (parseInt(report.totalAnnualLeaveDays, 10) || 0) +
      (parseInt(report.totalWeeklyLeaveDays, 10) || 0) +
      (parseInt(report.totalMedicalLeaveDays, 10) || 0) +
      (parseInt(report.totalOfficialLeaveDays, 10) || 0) +
      (parseInt(report.totalLeaveCompensationDays, 10) || 0);

    let updatedReport = { ...report };

    if (totalDays !== 30) {
      const daysDiff = 30 - totalDays;
      updatedReport.totalWeeklyLeaveDays = (parseInt(report.totalWeeklyLeaveDays, 10) || 0) + daysDiff;
    }

    const baseMealAllowance = 500;
    const absenceDays = parseInt(report.totalAbsenceDays, 10) || 0;
    updatedReport.mealAllowance = Math.max(0, baseMealAllowance - absenceDays * 50).toFixed(2);

    const lateDeductionDays = parseFloat(report.lateDeductionDays) || 0;
    const medicalLeaveDeductionDays = parseFloat(report.medicalLeaveDeductionDays) || 0;
    const totalDeductions = absenceDays + lateDeductionDays + medicalLeaveDeductionDays;
    updatedReport.totalDeductions = totalDeductions.toFixed(2);
    updatedReport.lateDeductionDays = lateDeductionDays.toFixed(2);
    updatedReport.medicalLeaveDeductionDays = medicalLeaveDeductionDays.toFixed(2);

    const dailySalary = parseFloat(report.baseSalary) / 30;
    const hourlyRate = dailySalary / 9;

    const penaltiesValue = parseFloat(report.penaltiesValue) || 0;
    const violationsInstallment = parseFloat(report.violationsInstallment) || 0;
    const advances = parseFloat(report.advances) || 0;
    updatedReport.deductionsValue = (totalDeductions * dailySalary + penaltiesValue + violationsInstallment + advances).toFixed(2);

    updatedReport.penaltiesValue = penaltiesValue.toFixed(2);
    updatedReport.violationsInstallment = violationsInstallment.toFixed(2);
    updatedReport.totalViolationsValue = (penaltiesValue + violationsInstallment).toFixed(2);
    updatedReport.advances = advances.toFixed(2);

    const overtimeValue = (parseFloat(report.totalOvertime) || 0) * hourlyRate;
    updatedReport.overtimeValue = overtimeValue.toFixed(2);

    updatedReport.netSalary = (
      parseFloat(report.baseSalary) +
      parseFloat(updatedReport.mealAllowance) +
      overtimeValue +
      parseFloat(report.eidBonus || 0) +
      parseFloat(report.totalLeaveCompensationValue || 0) -
      parseFloat(report.medicalInsurance) -
      parseFloat(report.socialInsurance) -
      parseFloat(updatedReport.deductionsValue)
    ).toFixed(2);

    return updatedReport;
  };

  const handleSearch = async () => {
    if (!dateFrom || !dateTo) {
      setError('يرجى إدخال تاريخ البداية وتاريخ النهاية');
      return;
    }

    const startDate = DateTime.fromISO(dateFrom, { zone: 'Africa/Cairo' });
    const endDate = DateTime.fromISO(dateTo, { zone: 'Africa/Cairo' });

    if (!startDate.isValid || !endDate.isValid) {
      setError('تاريخ البداية أو النهاية غير صالح');
      return;
    }

    if (startDate > endDate) {
      setError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('لم يتم العثور على رمز المصادقة');
      }
      const params = user.role === 'admin' ? { code: searchCode, dateFrom, dateTo } : { code: user.code, dateFrom, dateTo };
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/fingerprints/salary-report`,
        {
          params,
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log('API Response:', res.data);
      const normalizedReports = Array.isArray(res.data.salaryReports)
        ? res.data.salaryReports.map((report) => normalizeDays(report))
        : [normalizeDays(res.data)];
      setSalaryReports(normalizedReports);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      console.error('Error fetching salary reports:', {
        message: err.response?.data?.message || err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      setError(`خطأ أثناء البحث: ${err.response?.data?.message || err.message}`);
      setSalaryReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (report) => {
    if (user.role !== 'admin') {
      setError('التعديل متاح فقط للإداريين');
      return;
    }
    setEditingReport(report);
    setEditForm({
      code: report.code,
      fullName: report.fullName,
      department: report.department,
      baseSalary: report.baseSalary,
      medicalInsurance: report.medicalInsurance,
      socialInsurance: report.socialInsurance,
      mealAllowance: report.mealAllowance,
      totalWorkHours: report.totalWorkHours,
      totalWorkDays: report.totalWorkDays,
      totalAbsenceDays: report.totalAbsenceDays,
      lateDeductionDays: report.lateDeductionDays || '0.00',
      medicalLeaveDeductionDays: report.medicalLeaveDeductionDays || '0.00',
      totalDeductions: report.totalDeductions,
      deductionsValue: report.deductionsValue || '0.00',
      totalOvertime: report.totalOvertime,
      overtimeValue: report.overtimeValue,
      totalWeeklyLeaveDays: report.totalWeeklyLeaveDays,
      totalAnnualLeaveDays: report.totalAnnualLeaveDays,
      totalMedicalLeaveDays: report.totalMedicalLeaveDays,
      totalOfficialLeaveDays: report.totalOfficialLeaveDays || '0',
      totalLeaveCompensationDays: report.totalLeaveCompensationDays || '0',
      totalLeaveCompensationValue: report.totalLeaveCompensationValue || '0.00',
      totalAnnualLeaveYear: report.totalAnnualLeaveYear,
      annualLeaveBalance: report.annualLeaveBalance || '21',
      penaltiesValue: report.penaltiesValue || '0.00',
      violationsInstallment: report.violationsInstallment || '0.00',
      totalViolationsValue: report.totalViolationsValue || '0.00',
      advances: report.advances || '0.00',
      netSalary: report.netSalary,
      eidBonus: report.eidBonus || '0.00',
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (user.role !== 'admin') {
      setError('التعديل متاح فقط للإداريين');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (parseFloat(editForm.baseSalary) < 0) {
        setError('الراتب الأساسي لا يمكن أن يكون سالبًا');
        return;
      }
      if (parseFloat(editForm.medicalInsurance) < 0) {
        setError('التأمين الطبي لا يمكن أن يكون سالبًا');
        return;
      }
      if (parseFloat(editForm.socialInsurance) < 0) {
        setError('التأمين الاجتماعي لا يمكن أن يكون سالبًا');
        return;
      }
      if (parseFloat(editForm.totalOvertime) < 0) {
        setError('الساعات الإضافية لا يمكن أن تكون سالبة');
        return;
      }
      if (parseInt(editForm.totalAbsenceDays, 10) < 0) {
        setError('أيام الغياب لا يمكن أن تكون سالبة');
        return;
      }
      if (parseInt(editForm.totalAnnualLeaveDays, 10) < 0) {
        setError('أيام الإجازة السنوية لا يمكن أن تكون سالبة');
        return;
      }
      if (parseInt(editForm.totalMedicalLeaveDays, 10) < 0) {
        setError('أيام الإجازة الطبية لا يمكن أن تكون سالبة');
        return;
      }
      if (parseInt(editForm.totalOfficialLeaveDays, 10) < 0) {
        setError('أيام الإجازة الرسمية لا يمكن أن تكون سالبة');
        return;
      }
      if (parseInt(editForm.totalLeaveCompensationDays, 10) < 0) {
        setError('أيام بدل الإجازة لا يمكن أن تكون سالبة');
        return;
      }
      if (parseInt(editForm.totalWeeklyLeaveDays, 10) < 0) {
        setError('أيام الإجازة الأسبوعية لا يمكن أن تكون سالبة');
        return;
      }
      if (parseFloat(editForm.eidBonus) < 0) {
        setError('العيدية لا يمكن أن تكون سالبة');
        return;
      }
      if (parseFloat(editForm.advances) < 0) {
        setError('السلف لا يمكن أن تكون سالبة');
        return;
      }

      const prevAbsenceDays = parseInt(editingReport.totalAbsenceDays, 10) || 0;
      const newAbsenceDays = parseInt(editForm.totalAbsenceDays, 10) || 0;
      const prevAnnualLeaveDays = parseInt(editingReport.totalAnnualLeaveDays, 10) || 0;
      const newAnnualLeaveDays = parseInt(editForm.totalAnnualLeaveDays, 10) || 0;
      const prevMedicalLeaveDays = parseInt(editingReport.totalMedicalLeaveDays, 10) || 0;
      const newMedicalLeaveDays = parseInt(editForm.totalMedicalLeaveDays, 10) || 0;
      const prevOfficialLeaveDays = parseInt(editingReport.totalOfficialLeaveDays, 10) || 0;
      const newOfficialLeaveDays = parseInt(editForm.totalOfficialLeaveDays, 10) || 0;
      const prevLeaveCompensationDays = parseInt(editingReport.totalLeaveCompensationDays, 10) || 0;
      const newLeaveCompensationDays = parseInt(editForm.totalLeaveCompensationDays, 10) || 0;
      const lateDeductionDays = parseFloat(editingReport.lateDeductionDays) || 0;
      const medicalLeaveDeductionDays = parseFloat(editingReport.medicalLeaveDeductionDays) || 0;

      const annualLeaveDaysDiff = newAnnualLeaveDays - prevAnnualLeaveDays;

      const dailySalary = parseFloat(editForm.baseSalary) / 30;
      const hourlyRate = dailySalary / 9;
      const overtimeValue = (parseFloat(editForm.totalOvertime) || 0) * hourlyRate;
      const leaveCompensationValue = (newLeaveCompensationDays * dailySalary * 2).toFixed(2);

      const updatedTotalDeductions = newAbsenceDays + lateDeductionDays + medicalLeaveDeductionDays;

      const penaltiesValue = parseFloat(editForm.penaltiesValue) || 0;
      const violationsInstallment = parseFloat(editForm.violationsInstallment) || 0;
      const advances = parseFloat(editForm.advances) || 0;
      const updatedDeductionsValue = (updatedTotalDeductions * dailySalary + penaltiesValue + violationsInstallment + advances).toFixed(2);

      const baseMealAllowance = 500;
      const updatedMealAllowance = Math.max(0, baseMealAllowance - newAbsenceDays * 50).toFixed(2);

      const totalDays =
        (parseInt(editForm.totalWorkDays, 10) || 0) +
        newAbsenceDays +
        newAnnualLeaveDays +
        newMedicalLeaveDays +
        newOfficialLeaveDays +
        newLeaveCompensationDays +
        (parseInt(editForm.totalWeeklyLeaveDays, 10) || 0);
      let updatedWeeklyLeaveDays = parseInt(editForm.totalWeeklyLeaveDays, 10) || 0;
      if (totalDays !== 30) {
        updatedWeeklyLeaveDays += 30 - totalDays;
      }

      const updatedNetSalary = (
        parseFloat(editForm.baseSalary) +
        parseFloat(updatedMealAllowance) +
        overtimeValue +
        parseFloat(editForm.eidBonus || 0) +
        parseFloat(leaveCompensationValue) -
        parseFloat(editForm.medicalInsurance) -
        parseFloat(editForm.socialInsurance) -
        parseFloat(updatedDeductionsValue)
      ).toFixed(2);

      await axios.put(
        `${process.env.REACT_APP_API_URL}/api/users/${editForm.code}`,
        {
          code: editForm.code,
          fullName: editForm.fullName,
          department: editForm.department,
          baseSalary: parseFloat(editForm.baseSalary),
          medicalInsurance: parseFloat(editForm.medicalInsurance),
          socialInsurance: parseFloat(editForm.socialInsurance),
          mealAllowance: parseFloat(updatedMealAllowance),
          deductionsValue: parseFloat(updatedDeductionsValue),
          penaltiesValue: parseFloat(editForm.penaltiesValue) || 0,
          violationsInstallment: parseFloat(editForm.violationsInstallment) || 0,
          totalViolationsValue: (penaltiesValue + violationsInstallment).toFixed(2),
          advances: parseFloat(editForm.advances) || 0,
          totalAnnualLeave: parseFloat(editForm.totalAnnualLeaveYear) + annualLeaveDaysDiff,
          annualLeaveBalance: parseFloat(editForm.annualLeaveBalance) || 21,
          createdBy: user._id,
          eidBonus: parseFloat(editForm.eidBonus) || 0,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );

      setSalaryReports((prev) =>
        prev.map((report) =>
          report.code === editForm.code
            ? {
                ...report,
                ...editForm,
                mealAllowance: updatedMealAllowance,
                totalDeductions: updatedTotalDeductions.toFixed(2),
                deductionsValue: updatedDeductionsValue,
                overtimeValue: overtimeValue.toFixed(2),
                leaveCompensationValue: leaveCompensationValue,
                lateDeductionDays: lateDeductionDays.toFixed(2),
                medicalLeaveDeductionDays: medicalLeaveDeductionDays.toFixed(2),
                penaltiesValue: penaltiesValue.toFixed(2),
                violationsInstallment: violationsInstallment.toFixed(2),
                totalViolationsValue: (penaltiesValue + violationsInstallment).toFixed(2),
                advances: advances.toFixed(2),
                netSalary: updatedNetSalary,
                totalWeeklyLeaveDays: updatedWeeklyLeaveDays,
                totalAnnualLeaveYear: parseFloat(editForm.totalAnnualLeaveYear) + annualLeaveDaysDiff,
                annualLeaveBalance: parseFloat(editForm.annualLeaveBalance) || 21,
                eidBonus: parseFloat(editForm.eidBonus) || 0,
              }
            : report
        )
      );

      setEditingReport(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      console.error('Error updating report:', {
        message: err.response?.data?.message || err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      setError(`خطأ أثناء التعديل: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCancel = () => {
    setEditingReport(null);
    setEditForm({});
    setError('');
  };

  const handleExportToExcel = () => {
    if (user.role !== 'admin') {
      setError('تصدير التقرير متاح فقط للإداريين');
      return;
    }
    try {
      const headers = user.role === 'admin' ? [
        'الراتب الصافي',
        'عيدية',
        'إجمالي قيمة المخالفات',
        'قسط المخالفات',
        'قيمة الجزاءات',
        'السلف',
        'قيمة الخصومات',
        'إجمالي الخصومات (أيام)',
        'خصم الإجازة الطبية (أيام)',
        'خصم التأخير (أيام)',
        'رصيد الإجازة السنوية',
        'إجمالي أيام الإجازة السنوية (السنة)',
        'قيمة بدل الإجازة',
        'إجمالي أيام بدل الإجازة',
        'إجمالي أيام الإجازة الرسمية',
        'إجمالي أيام الإجازة الطبية',
        'إجمالي أيام الإجازة السنوية (الفترة)',
        'إجمالي أيام الإجازة الأسبوعية',
        'قيمة الساعات الإضافية',
        'إجمالي الساعات الإضافية',
        'إجمالي أيام الغياب',
        'إجمالي أيام العمل',
        'إجمالي ساعات العمل',
        'التأمين الاجتماعي',
        'التأمين الطبي',
        'بدل الوجبة',
        'الراتب الأساسي',
        'القسم',
        'الاسم',
        'كود الموظف',
      ] : [
        'الراتب الصافي',
        'عيدية',
        'السلف',
        'قيمة الخصومات',
        'خصم التأخير (أيام)',
        'رصيد الإجازة السنوية',
        'إجمالي أيام الإجازة السنوية (الفترة)',
        'إجمالي أيام الإجازة الأسبوعية',
        'قيمة الساعات الإضافية',
        'إجمالي الساعات الإضافية',
        'إجمالي أيام الغياب',
        'إجمالي أيام العمل',
        'إجمالي ساعات العمل',
        'التأمين الاجتماعي',
        'التأمين الطبي',
        'بدل الوجبة',
        'الراتب الأساسي',
      ];

      const data = salaryReports.map((report) => {
        const baseData = {
          'الراتب الأساسي': parseFloat(report.baseSalary).toFixed(2),
          'بدل الوجبة': parseFloat(report.mealAllowance).toFixed(2),
          'التأمين الطبي': parseFloat(report.medicalInsurance).toFixed(2),
          'التأمين الاجتماعي': parseFloat(report.socialInsurance).toFixed(2),
          'إجمالي ساعات العمل': parseFloat(report.totalWorkHours).toFixed(2),
          'إجمالي أيام العمل': parseInt(report.totalWorkDays, 10) || 0,
          'إجمالي أيام الغياب': parseInt(report.totalAbsenceDays, 10) || 0,
          'إجمالي الساعات الإضافية': parseFloat(report.totalOvertime).toFixed(2),
          'قيمة الساعات الإضافية': parseFloat(report.overtimeValue).toFixed(2),
          'إجمالي أيام الإجازة الأسبوعية': parseInt(report.totalWeeklyLeaveDays, 10) || 0,
          'إجمالي أيام الإجازة السنوية (الفترة)': parseInt(report.totalAnnualLeaveDays, 10) || 0,
          'رصيد الإجازة السنوية': parseInt(report.annualLeaveBalance, 10) || 21,
          'خصم التأخير (أيام)': parseFloat(report.lateDeductionDays || 0).toFixed(2),
          'قيمة الخصومات': parseFloat(report.deductionsValue || 0).toFixed(2),
          'السلف': parseFloat(report.advances || 0).toFixed(2),
          'عيدية': parseFloat(report.eidBonus || 0).toFixed(2),
          'الراتب الصافي': parseFloat(report.netSalary).toFixed(2),
        };
        if (user.role === 'admin') {
          return {
            ...baseData,
            'كود الموظف': report.code,
            'الاسم': report.fullName,
            'القسم': report.department,
            'إجمالي أيام الإجازة السنوية (السنة)': parseInt(report.totalAnnualLeaveYear, 10) || 0,
            'قيمة بدل الإجازة': parseFloat(report.totalLeaveCompensationValue || 0).toFixed(2),
            'إجمالي أيام بدل الإجازة': parseInt(report.totalLeaveCompensationDays, 10) || 0,
            'إجمالي أيام الإجازة الرسمية': parseInt(report.totalOfficialLeaveDays, 10) || 0,
            'إجمالي أيام الإجازة الطبية': parseInt(report.totalMedicalLeaveDays, 10) || 0,
            'خصم الإجازة الطبية (أيام)': parseFloat(report.medicalLeaveDeductionDays || 0).toFixed(2),
            'إجمالي الخصومات (أيام)': parseFloat(report.totalDeductions).toFixed(2),
            'قيمة الجزاءات': parseFloat(report.penaltiesValue || 0).toFixed(2),
            'قسط المخالفات': parseFloat(report.violationsInstallment || 0).toFixed(2),
            'إجمالي قيمة المخالفات': parseFloat(report.totalViolationsValue || 0).toFixed(2),
          };
        }
        return baseData;
      });

      const totals = user.role === 'admin' ? {
        'الراتب الصافي': salaryReports.reduce((sum, report) => sum + parseFloat(report.netSalary || 0), 0).toFixed(2),
        'عيدية': salaryReports.reduce((sum, report) => sum + parseFloat(report.eidBonus || 0), 0).toFixed(2),
        'إجمالي قيمة المخالفات': salaryReports.reduce((sum, report) => sum + parseFloat(report.totalViolationsValue || 0), 0).toFixed(2),
        'قسط المخالفات': salaryReports.reduce((sum, report) => sum + parseFloat(report.violationsInstallment || 0), 0).toFixed(2),
        'قيمة الجزاءات': salaryReports.reduce((sum, report) => sum + parseFloat(report.penaltiesValue || 0), 0).toFixed(2),
        'السلف': salaryReports.reduce((sum, report) => sum + parseFloat(report.advances || 0), 0).toFixed(2),
        'قيمة الخصومات': salaryReports.reduce((sum, report) => sum + parseFloat(report.deductionsValue || 0), 0).toFixed(2),
        'إجمالي الخصومات (أيام)': salaryReports.reduce((sum, report) => sum + parseFloat(report.totalDeductions || 0), 0).toFixed(2),
        'خصم الإجازة الطبية (أيام)': salaryReports.reduce((sum, report) => sum + parseFloat(report.medicalLeaveDeductionDays || 0), 0).toFixed(2),
        'خصم التأخير (أيام)': salaryReports.reduce((sum, report) => sum + parseFloat(report.lateDeductionDays || 0), 0).toFixed(2),
        'رصيد الإجازة السنوية': salaryReports.reduce((sum, report) => sum + parseInt(report.annualLeaveBalance, 10) || 21, 0),
        'إجمالي أيام الإجازة السنوية (السنة)': salaryReports.reduce((sum, report) => sum + parseInt(report.totalAnnualLeaveYear, 10) || 0, 0),
        'قيمة بدل الإجازة': salaryReports.reduce((sum, report) => sum + parseFloat(report.totalLeaveCompensationValue || 0), 0).toFixed(2),
        'إجمالي أيام بدل الإجازة': salaryReports.reduce((sum, report) => sum + parseInt(report.totalLeaveCompensationDays, 10) || 0, 0),
        'إجمالي أيام الإجازة الرسمية': salaryReports.reduce((sum, report) => sum + parseInt(report.totalOfficialLeaveDays, 10) || 0, 0),
        'إجمالي أيام الإجازة الطبية': salaryReports.reduce((sum, report) => sum + parseInt(report.totalMedicalLeaveDays, 10) || 0, 0),
        'إجمالي أيام الإجازة السنوية (الفترة)': salaryReports.reduce((sum, report) => sum + parseInt(report.totalAnnualLeaveDays, 10) || 0, 0),
        'إجمالي أيام الإجازة الأسبوعية': salaryReports.reduce((sum, report) => sum + parseInt(report.totalWeeklyLeaveDays, 10) || 0, 0),
        'قيمة الساعات الإضافية': salaryReports.reduce((sum, report) => sum + parseFloat(report.overtimeValue || 0), 0).toFixed(2),
        'إجمالي الساعات الإضافية': salaryReports.reduce((sum, report) => sum + parseFloat(report.totalOvertime || 0), 0).toFixed(2),
        'إجمالي أيام الغياب': salaryReports.reduce((sum, report) => sum + parseInt(report.totalAbsenceDays, 10) || 0, 0),
        'إجمالي أيام العمل': salaryReports.reduce((sum, report) => sum + parseInt(report.totalWorkDays, 10) || 0, 0),
        'إجمالي ساعات العمل': salaryReports.reduce((sum, report) => sum + parseFloat(report.totalWorkHours || 0), 0).toFixed(2),
        'التأمين الاجتماعي': salaryReports.reduce((sum, report) => sum + parseFloat(report.socialInsurance || 0), 0).toFixed(2),
        'التأمين الطبي': salaryReports.reduce((sum, report) => sum + parseFloat(report.medicalInsurance || 0), 0).toFixed(2),
        'بدل الوجبة': salaryReports.reduce((sum, report) => sum + parseFloat(report.mealAllowance || 0), 0).toFixed(2),
        'الراتب الأساسي': salaryReports.reduce((sum, report) => sum + parseFloat(report.baseSalary || 0), 0).toFixed(2),
        'القسم': 'الإجمالي',
        'الاسم': '',
        'كود الموظف': '',
      } : {
        'الراتب الصافي': salaryReports.reduce((sum, report) => sum + parseFloat(report.netSalary || 0), 0).toFixed(2),
        'عيدية': salaryReports.reduce((sum, report) => sum + parseFloat(report.eidBonus || 0), 0).toFixed(2),
        'السلف': salaryReports.reduce((sum, report) => sum + parseFloat(report.advances || 0), 0).toFixed(2),
        'قيمة الخصومات': salaryReports.reduce((sum, report) => sum + parseFloat(report.deductionsValue || 0), 0).toFixed(2),
        'خصم التأخير (أيام)': salaryReports.reduce((sum, report) => sum + parseFloat(report.lateDeductionDays || 0), 0).toFixed(2),
        'رصيد الإجازة السنوية': salaryReports.reduce((sum, report) => sum + parseInt(report.annualLeaveBalance, 10) || 21, 0),
        'إجمالي أيام الإجازة السنوية (الفترة)': salaryReports.reduce((sum, report) => sum + parseInt(report.totalAnnualLeaveDays, 10) || 0, 0),
        'إجمالي أيام الإجازة الأسبوعية': salaryReports.reduce((sum, report) => sum + parseInt(report.totalWeeklyLeaveDays, 10) || 0, 0),
        'قيمة الساعات الإضافية': salaryReports.reduce((sum, report) => sum + parseFloat(report.overtimeValue || 0), 0).toFixed(2),
        'إجمالي الساعات الإضافية': salaryReports.reduce((sum, report) => sum + parseFloat(report.totalOvertime || 0), 0).toFixed(2),
        'إجمالي أيام الغياب': salaryReports.reduce((sum, report) => sum + parseInt(report.totalAbsenceDays, 10) || 0, 0),
        'إجمالي أيام العمل': salaryReports.reduce((sum, report) => sum + parseInt(report.totalWorkDays, 10) || 0, 0),
        'إجمالي ساعات العمل': salaryReports.reduce((sum, report) => sum + parseFloat(report.totalWorkHours || 0), 0).toFixed(2),
        'التأمين الاجتماعي': salaryReports.reduce((sum, report) => sum + parseFloat(report.socialInsurance || 0), 0).toFixed(2),
        'التأمين الطبي': salaryReports.reduce((sum, report) => sum + parseFloat(report.medicalInsurance || 0), 0).toFixed(2),
        'بدل الوجبة': salaryReports.reduce((sum, report) => sum + parseFloat(report.mealAllowance || 0), 0).toFixed(2),
        'الراتب الأساسي': salaryReports.reduce((sum, report) => sum + parseFloat(report.baseSalary || 0), 0).toFixed(2),
      };

      data.push(totals);

      const ws = XLSX.utils.json_to_sheet(data, { header: headers });
      ws['!cols'] = headers.map(() => ({ wch: 20 }));
      ws['!rtl'] = true;
      headers.forEach((_, index) => {
        const cell = XLSX.utils.encode_cell({ c: index, r: 0 });
        ws[cell].s = {
          font: { name: 'Amiri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: '4B6587' } },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } },
          },
        };
      });
      data.forEach((_, rowIndex) => {
        headers.forEach((_, colIndex) => {
          const cell = XLSX.utils.encode_cell({ c: colIndex, r: rowIndex + 1 });
          ws[cell].s = {
            font: { name: 'Amiri', sz: 11, color: { rgb: '333333' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: rowIndex % 2 === 0 ? 'F7F9FB' : 'FFFFFF' } },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } },
            },
          };
        });
      });
      const totalsRow = data.length;
      headers.forEach((_, index) => {
        const cell = XLSX.utils.encode_cell({ c: index, r: totalsRow });
        ws[cell].s = {
          font: { name: 'Amiri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: 'A3BFFA' } },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } },
          },
        };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'تقرير المرتب الشهري');
      XLSX.writeFile(wb, `تقرير_المرتب_الشهري_${dateFrom}_إلى_${dateTo}.xlsx`);
    } catch (err) {
      console.error('Error exporting to Excel:', err.message);
      setError('خطأ أثناء تصدير ملف Excel: ' + err.message);
    }
  };

  const handleExportToWord = async () => {
    if (user.role !== 'admin') {
      setError('تصدير التقرير متاح فقط للإداريين');
      return;
    }
    try {
      const headers = user.role === 'admin' ? [
        'الراتب الصافي',
        'عيدية',
        'إجمالي قيمة المخالفات',
        'قسط المخالفات',
        'قيمة الجزاءات',
        'السلف',
        'قيمة الخصومات',
        'إجمالي الخصومات (أيام)',
        'خصم الإجازة الطبية (أيام)',
        'خصم التأخير (أيام)',
        'رصيد الإجازة السنوية',
        'إجمالي أيام الإجازة السنوية (السنة)',
        'قيمة بدل الإجازة',
        'إجمالي أيام بدل الإجازة',
        'إجمالي أيام الإجازة الرسمية',
        'إجمالي أيام الإجازة الطبية',
        'إجمالي أيام الإجازة السنوية (الفترة)',
        'إجمالي أيام الإجازة الأسبوعية',
        'قيمة الساعات الإضافية',
        'إجمالي الساعات الإضافية',
        'إجمالي أيام الغياب',
        'إجمالي أيام العمل',
        'إجمالي ساعات العمل',
        'التأمين الاجتماعي',
        'التأمين الطبي',
        'بدل الوجبة',
        'الراتب الأساسي',
        'القسم',
        'الاسم',
        'كود الموظف',
      ] : [
        'الراتب الصافي',
        'عيدية',
        'السلف',
        'قيمة الخصومات',
        'خصم التأخير (أيام)',
        'رصيد الإجازة السنوية',
        'إجمالي أيام الإجازة السنوية (الفترة)',
        'إجمالي أيام الإجازة الأسبوعية',
        'قيمة الساعات الإضافية',
        'إجمالي الساعات الإضافية',
        'إجمالي أيام الغياب',
        'إجمالي أيام العمل',
        'إجمالي ساعات العمل',
        'التأمين الاجتماعي',
        'التأمين الطبي',
        'بدل الوجبة',
        'الراتب الأساسي',
      ];

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: { top: 720, right: 720, bottom: 720, left: 720 },
              },
            },
            children: [
              new Paragraph({
                text: 'تقرير المرتب الشهري',
                heading: 'Title',
                alignment: 'right',
                spacing: { after: 200 },
                children: [
                  new TextRun({
                    font: 'Amiri',
                    size: 32,
                    rightToLeft: true,
                    color: '4B6587',
                  }),
                ],
              }),
              new Paragraph({
                text: `تاريخ الإصدار: من ${DateTime.fromISO(dateFrom).toLocaleString(DateTime.DATE_FULL, { locale: 'ar' })} إلى ${DateTime.fromISO(dateTo).toLocaleString(DateTime.DATE_FULL, { locale: 'ar' })}`,
                alignment: 'right',
                spacing: { after: 400 },
                children: [
                  new TextRun({
                    font: 'Amiri',
                    size: 20,
                    rightToLeft: true,
                    color: '333333',
                  }),
                ],
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: headers.map(
                      (header) =>
                        new TableCell({
                          children: [
                            new Paragraph({
                              text: header,
                              alignment: 'center',
                              children: [
                                new TextRun({
                                  font: 'Amiri',
                                  size: 20,
                                  bold: true,
                                  rightToLeft: true,
                                  color: 'FFFFFF',
                                }),
                              ],
                            }),
                          ],
                          width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
                          shading: { fill: '4B6587', type: ShadingType.SOLID },
                        })
                    ),
                  }),
                  ...salaryReports.map(
                    (report, index) => {
                      const rowData = user.role === 'admin' ? [
                        parseFloat(report.netSalary).toFixed(2),
                        parseFloat(report.eidBonus || 0).toFixed(2),
                        parseFloat(report.totalViolationsValue || 0).toFixed(2),
                        parseFloat(report.violationsInstallment || 0).toFixed(2),
                        parseFloat(report.penaltiesValue || 0).toFixed(2),
                        parseFloat(report.advances || 0).toFixed(2),
                        parseFloat(report.deductionsValue || 0).toFixed(2),
                        parseFloat(report.totalDeductions).toFixed(2),
                        parseFloat(report.medicalLeaveDeductionDays || 0).toFixed(2),
                        parseFloat(report.lateDeductionDays || 0).toFixed(2),
                        parseInt(report.annualLeaveBalance, 10).toString() || '21',
                        parseInt(report.totalAnnualLeaveYear, 10).toString() || '0',
                        parseFloat(report.totalLeaveCompensationValue || 0).toFixed(2),
                        parseInt(report.totalLeaveCompensationDays, 10).toString() || '0',
                        parseInt(report.totalOfficialLeaveDays, 10).toString() || '0',
                        parseInt(report.totalMedicalLeaveDays, 10).toString() || '0',
                        parseInt(report.totalAnnualLeaveDays, 10).toString() || '0',
                        parseInt(report.totalWeeklyLeaveDays, 10).toString() || '0',
                        parseFloat(report.overtimeValue).toFixed(2),
                        parseFloat(report.totalOvertime).toFixed(2),
                        parseInt(report.totalAbsenceDays, 10).toString() || '0',
                        parseInt(report.totalWorkDays, 10).toString() || '0',
                        parseFloat(report.totalWorkHours).toFixed(2),
                        parseFloat(report.socialInsurance).toFixed(2),
                        parseFloat(report.medicalInsurance).toFixed(2),
                        parseFloat(report.mealAllowance).toFixed(2),
                        parseFloat(report.baseSalary).toFixed(2),
                        report.department,
                        report.fullName,
                        report.code,
                      ] : [
                        parseFloat(report.netSalary).toFixed(2),
                        parseFloat(report.eidBonus || 0).toFixed(2),
                        parseFloat(report.advances || 0).toFixed(2),
                        parseFloat(report.deductionsValue || 0).toFixed(2),
                        parseFloat(report.lateDeductionDays || 0).toFixed(2),
                        parseInt(report.annualLeaveBalance, 10).toString() || '21',
                        parseInt(report.totalAnnualLeaveDays, 10).toString() || '0',
                        parseInt(report.totalWeeklyLeaveDays, 10).toString() || '0',
                        parseFloat(report.overtimeValue).toFixed(2),
                        parseFloat(report.totalOvertime).toFixed(2),
                        parseInt(report.totalAbsenceDays, 10).toString() || '0',
                        parseInt(report.totalWorkDays, 10).toString() || '0',
                        parseFloat(report.totalWorkHours).toFixed(2),
                        parseFloat(report.socialInsurance).toFixed(2),
                        parseFloat(report.medicalInsurance).toFixed(2),
                        parseFloat(report.mealAllowance).toFixed(2),
                        parseFloat(report.baseSalary).toFixed(2),
                      ];
                      return new TableRow({
                        children: rowData.map(
                          (value) =>
                            new TableCell({
                              children: [
                                new Paragraph({
                                  text: value,
                                  alignment: 'center',
                                  children: [
                                    new TextRun({
                                      font: 'Amiri',
                                      size: 20,
                                      rightToLeft: true,
                                      color: '333333',
                                    }),
                                  ],
                                }),
                              ],
                              width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
                              shading: { fill: index % 2 === 0 ? 'F7F9FB' : 'FFFFFF', type: ShadingType.SOLID },
                            })
                        ),
                      });
                    }
                  ),
                  new TableRow({
                    children: (user.role === 'admin' ? [
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.netSalary || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.eidBonus || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.totalViolationsValue || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.violationsInstallment || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.penaltiesValue || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.advances || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.deductionsValue || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.totalDeductions || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.medicalLeaveDeductionDays || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.lateDeductionDays || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.annualLeaveBalance, 10) || 21, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.totalAnnualLeaveYear, 10) || 0, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.totalLeaveCompensationValue || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.totalLeaveCompensationDays, 10) || 0, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.totalOfficialLeaveDays, 10) || 0, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.totalMedicalLeaveDays, 10) || 0, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.totalAnnualLeaveDays, 10) || 0, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.totalWeeklyLeaveDays, 10) || 0, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.overtimeValue || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.totalOvertime || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.totalAbsenceDays, 10) || 0, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.totalWorkDays, 10) || 0, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.totalWorkHours || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.socialInsurance || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.medicalInsurance || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.mealAllowance || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.baseSalary || 0), 0).toFixed(2),
                      'الإجمالي',
                      '',
                      '',
                    ] : [
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.netSalary || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.eidBonus || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.advances || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.deductionsValue || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.lateDeductionDays || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.annualLeaveBalance, 10) || 21, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.totalAnnualLeaveDays, 10) || 0, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.totalWeeklyLeaveDays, 10) || 0, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.overtimeValue || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.totalOvertime || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.totalAbsenceDays, 10) || 0, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseInt(report.totalWorkDays, 10) || 0, 0).toString(),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.totalWorkHours || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.socialInsurance || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.medicalInsurance || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.mealAllowance || 0), 0).toFixed(2),
                      salaryReports.reduce((sum, report) => sum + parseFloat(report.baseSalary || 0), 0).toFixed(2),
                    ]).map(
                      (value) =>
                        new TableCell({
                          children: [
                            new Paragraph({
                              text: value,
                              alignment: 'center',
                              children: [
                                new TextRun({
                                  font: 'Amiri',
                                  size: 20,
                                  bold: true,
                                  rightToLeft: true,
                                  color: 'FFFFFF',
                                }),
                              ],
                            }),
                          ],
                          width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
                          shading: { fill: 'A3BFFA', type: ShadingType.SOLID },
                        })
                    ),
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `تقرير_المرتب_الشهري_${dateFrom}_إلى_${dateTo}.docx`);
    } catch (err) {
      console.error('Error exporting to Word:', err.message);
      setError('خطأ أثناء تصدير ملف Word: ' + err.message);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="container mx-auto p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white p-4 sm:p-6 rounded-lg shadow-lg border border-gray-200 mb-6"
        >
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 text-right font-amiri">
            {user.role === 'admin' ? 'البحث في تقرير المرتب الشهري' : 'تقرير راتبك الشهري'}
          </h2>
          {user.role !== 'admin' && (
            <p className="text-gray-600 mb-4 text-right text-sm font-amiri">
              أدخل الفترة الزمنية لعرض تقرير راتبك الخاص.
            </p>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-right text-sm font-amiri"
            >
              {error}
            </motion.div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {user.role === 'admin' && (
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                  كود الموظف
                </label>
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                  placeholder="أدخل كود الموظف"
                  dir="rtl"
                  disabled={loading}
                />
              </div>
            )}
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                من تاريخ
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                dir="rtl"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                إلى تاريخ
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                dir="rtl"
                disabled={loading}
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-3 mt-6">
            <motion.button
              onClick={handleSearch}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-300 text-sm font-amiri ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'جارٍ البحث...' : 'بحث'}
            </motion.button>
            {user.role === 'admin' && (
              <>
                <motion.button
                  onClick={handleExportToExcel}
                  disabled={loading || salaryReports.length === 0}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors duration-300 text-sm font-amiri ${
                    loading || salaryReports.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  تصدير إلى Excel
                </motion.button>
                <motion.button
                  onClick={handleExportToWord}
                  disabled={loading || salaryReports.length === 0}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors duration-300 text-sm font-amiri ${
                    loading || salaryReports.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  تصدير إلى Word
                </motion.button>
              </>
            )}
          </div>
        </motion.div>

        <AnimatePresence>
          {user.role === 'admin' && editingReport && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto relative"
                onClick={(e) => e.stopPropagation()}
              >
                <motion.button
                  onClick={handleEditCancel}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="absolute top-3 left-3 text-gray-600 hover:text-red-600 transition-colors duration-300"
                  aria-label="إغلاق"
                >
                  <XIcon className="h-6 w-6" />
                </motion.button>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 text-right font-amiri">تعديل تقرير المرتب</h2>
                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-right text-sm font-amiri"
                  >
                    {error}
                  </motion.div>
                )}
                <form onSubmit={handleEditSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      كود الموظف
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={editForm.code}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right bg-gray-100 cursor-not-allowed text-sm font-amiri transition-all duration-300"
                      readOnly
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      الاسم الكامل
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={editForm.fullName}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      required
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      القسم
                    </label>
                    <input
                      type="text"
                      name="department"
                      value={editForm.department}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      required
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      الراتب الأساسي
                    </label>
                    <input
                      type="number"
                      name="baseSalary"
                      value={editForm.baseSalary}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      required
                      min="0"
                      step="0.01"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      التأمين الطبي
                    </label>
                    <input
                      type="number"
                      name="medicalInsurance"
                      value={editForm.medicalInsurance}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      step="0.01"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      التأمين الاجتماعي
                    </label>
                    <input
                      type="number"
                      name="socialInsurance"
                      value={editForm.socialInsurance}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      step="0.01"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      عيدية
                    </label>
                    <input
                      type="number"
                      name="eidBonus"
                      value={editForm.eidBonus}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      step="0.01"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      بدل الوجبة
                    </label>
                    <input
                      type="number"
                      name="mealAllowance"
                      value={editForm.mealAllowance}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right bg-gray-100 cursor-not-allowed text-sm font-amiri transition-all duration-300"
                      readOnly
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      إجمالي ساعات العمل
                    </label>
                    <input
                      type="number"
                      name="totalWorkHours"
                      value={editForm.totalWorkHours}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      step="0.01"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      إجمالي أيام العمل
                    </label>
                    <input
                      type="number"
                      name="totalWorkDays"
                      value={editForm.totalWorkDays}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      إجمالي أيام الغياب
                    </label>
                    <input
                      type="number"
                      name="totalAbsenceDays"
                      value={editForm.totalAbsenceDays}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      dir="rtl"
                    />
                  </div>
                  <div>
		                      <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      إجمالي الساعات الإضافية
                    </label>
                    <input
                      type="number"
                      name="totalOvertime"
                      value={editForm.totalOvertime}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      step="0.01"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      إجمالي أيام الإجازة الأسبوعية
                    </label>
                    <input
                      type="number"
                      name="totalWeeklyLeaveDays"
                      value={editForm.totalWeeklyLeaveDays}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      إجمالي أيام الإجازة السنوية (الفترة)
                    </label>
                    <input
                      type="number"
                      name="totalAnnualLeaveDays"
                      value={editForm.totalAnnualLeaveDays}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      إجمالي أيام الإجازة الطبية
                    </label>
                    <input
                      type="number"
                      name="totalMedicalLeaveDays"
                      value={editForm.totalMedicalLeaveDays}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      إجمالي أيام الإجازة الرسمية
                    </label>
                    <input
                      type="number"
                      name="totalOfficialLeaveDays"
                      value={editForm.totalOfficialLeaveDays}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      إجمالي أيام بدل الإجازة
                    </label>
                    <input
                      type="number"
                      name="totalLeaveCompensationDays"
                      value={editForm.totalLeaveCompensationDays}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      إجمالي أيام الإجازة السنوية (السنة)
                    </label>
                    <input
                      type="number"
                      name="totalAnnualLeaveYear"
                      value={editForm.totalAnnualLeaveYear}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      رصيد الإجازة السنوية
                    </label>
                    <input
                      type="number"
                      name="annualLeaveBalance"
                      value={editForm.annualLeaveBalance}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      خصم التأخير (أيام)
                    </label>
                    <input
                      type="number"
                      name="lateDeductionDays"
                      value={editForm.lateDeductionDays}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      step="0.01"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      خصم الإجازة الطبية (أيام)
                    </label>
                    <input
                      type="number"
                      name="medicalLeaveDeductionDays"
                      value={editForm.medicalLeaveDeductionDays}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      step="0.01"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      قيمة الجزاءات
                    </label>
                    <input
                      type="number"
                      name="penaltiesValue"
                      value={editForm.penaltiesValue}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      step="0.01"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      قسط المخالفات
                    </label>
                    <input
                      type="number"
                      name="violationsInstallment"
                      value={editForm.violationsInstallment}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      step="0.01"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right font-amiri">
                      السلف
                    </label>
                    <input
                      type="number"
                      name="advances"
                      value={editForm.advances}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-amiri transition-all duration-300"
                      min="0"
                      step="0.01"
                      dir="rtl"
                    />
                  </div>
                </form>
                <div className="flex justify-end gap-3 mt-6">
                  <motion.button
                    onClick={handleEditSubmit}
                    disabled={loading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-300 text-sm font-amiri ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {loading ? 'جارٍ الحفظ...' : 'حفظ'}
                  </motion.button>
                  <motion.button
                    onClick={handleEditCancel}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors duration-300 text-sm font-amiri"
                  >
                    إلغاء
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {salaryReports.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white p-4 sm:p-6 rounded-lg shadow-lg border border-gray-200"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 text-right font-amiri">نتائج تقرير المرتب</h2>
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse">
                <thead>
                  <tr className="bg-blue-100">
                    {user.role === 'admin' && (
                      <>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">الإجراءات</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">كود الموظف</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">الاسم</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">القسم</th>
                      </>
                    )}
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">الراتب الأساسي</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">بدل الوجبة</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">التأمين الطبي</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">التأمين الاجتماعي</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">إجمالي ساعات العمل</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">إجمالي أيام العمل</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">إجمالي أيام الغياب</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">إجمالي الساعات الإضافية</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">قيمة الساعات الإضافية</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">إجمالي أيام الإجازة الأسبوعية</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">إجمالي أيام الإجازة السنوية (الفترة)</th>
                    {user.role === 'admin' && (
                      <>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">إجمالي أيام الإجازة الطبية</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">إجمالي أيام الإجازة الرسمية</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">إجمالي أيام بدل الإجازة</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">قيمة بدل الإجازة</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">إجمالي أيام الإجازة السنوية (السنة)</th>
                      </>
                    )}
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">رصيد الإجازة السنوية</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">خصم التأخير (أيام)</th>
                    {user.role === 'admin' && (
                      <>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">خصم الإجازة الطبية (أيام)</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">إجمالي الخصومات (أيام)</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">قيمة الجزاءات</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">قسط المخالفات</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">إجمالي قيمة المخالفات</th>
                      </>
                    )}
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">السلف</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">قيمة الخصومات</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">عيدية</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 font-amiri border border-gray-300">الراتب الصافي</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryReports.map((report, index) => (
                    <tr key={report.code} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      {user.role === 'admin' && (
                        <>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">
                            <motion.button
                              onClick={() => handleEditClick(report)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition-colors duration-300 text-sm font-amiri"
                            >
                              تعديل
                            </motion.button>
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{report.code}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{report.fullName}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{report.department}</td>
                        </>
                      )}
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.baseSalary).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.mealAllowance).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.medicalInsurance).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.socialInsurance).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.totalWorkHours).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseInt(report.totalWorkDays, 10) || 0}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseInt(report.totalAbsenceDays, 10) || 0}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.totalOvertime).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.overtimeValue).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseInt(report.totalWeeklyLeaveDays, 10) || 0}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseInt(report.totalAnnualLeaveDays, 10) || 0}</td>
                      {user.role === 'admin' && (
                        <>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseInt(report.totalMedicalLeaveDays, 10) || 0}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseInt(report.totalOfficialLeaveDays, 10) || 0}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseInt(report.totalLeaveCompensationDays, 10) || 0}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.totalLeaveCompensationValue || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseInt(report.totalAnnualLeaveYear, 10) || 0}</td>
                        </>
                      )}
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseInt(report.annualLeaveBalance, 10) || 21}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.lateDeductionDays || 0).toFixed(2)}</td>
                      {user.role === 'admin' && (
                        <>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.medicalLeaveDeductionDays || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.totalDeductions).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.penaltiesValue || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.violationsInstallment || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.totalViolationsValue || 0).toFixed(2)}</td>
                        </>
                      )}
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.advances || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.deductionsValue || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.eidBonus || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600 font-amiri border border-gray-300">{parseFloat(report.netSalary).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-100 font-bold">
                    {user.role === 'admin' && (
                      <>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300"></td>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300"></td>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300"></td>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">الإجمالي</td>
                      </>
                    )}
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseFloat(report.baseSalary || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseFloat(report.mealAllowance || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseFloat(report.medicalInsurance || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseFloat(report.socialInsurance || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseFloat(report.totalWorkHours || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseInt(report.totalWorkDays, 10) || 0, 0)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseInt(report.totalAbsenceDays, 10) || 0, 0)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseFloat(report.totalOvertime || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseFloat(report.overtimeValue || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseInt(report.totalWeeklyLeaveDays, 10) || 0, 0)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseInt(report.totalAnnualLeaveDays, 10) || 0, 0)}
                    </td>
                    {user.role === 'admin' && (
                      <>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                          {salaryReports.reduce((sum, report) => sum + parseInt(report.totalMedicalLeaveDays, 10) || 0, 0)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                          {salaryReports.reduce((sum, report) => sum + parseInt(report.totalOfficialLeaveDays, 10) || 0, 0)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                          {salaryReports.reduce((sum, report) => sum + parseInt(report.totalLeaveCompensationDays, 10) || 0, 0)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                          {salaryReports.reduce((sum, report) => sum + parseFloat(report.totalLeaveCompensationValue || 0), 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                          {salaryReports.reduce((sum, report) => sum + parseInt(report.totalAnnualLeaveYear, 10) || 0, 0)}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseInt(report.annualLeaveBalance, 10) || 21, 0)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseFloat(report.lateDeductionDays || 0), 0).toFixed(2)}
                    </td>
                    {user.role === 'admin' && (
                      <>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                          {salaryReports.reduce((sum, report) => sum + parseFloat(report.medicalLeaveDeductionDays || 0), 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                          {salaryReports.reduce((sum, report) => sum + parseFloat(report.totalDeductions || 0), 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                          {salaryReports.reduce((sum, report) => sum + parseFloat(report.penaltiesValue || 0), 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                          {salaryReports.reduce((sum, report) => sum + parseFloat(report.violationsInstallment || 0), 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                          {salaryReports.reduce((sum, report) => sum + parseFloat(report.totalViolationsValue || 0), 0).toFixed(2)}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseFloat(report.advances || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseFloat(report.deductionsValue || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseFloat(report.eidBonus || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 font-amiri border border-gray-300">
                      {salaryReports.reduce((sum, report) => sum + parseFloat(report.netSalary || 0), 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {loading && <LoadingSpinner />}
          {showSuccess && <SuccessCheckmark onComplete={() => setShowSuccess(false)} />}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MonthlySalaryReport;
