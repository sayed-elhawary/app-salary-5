import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../components/AuthProvider';
import NavBar from '../components/NavBar';
import ReportTable from '../components/ReportTable';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { DateTime } from 'luxon';

// مكون مؤشر التحميل الأنيق
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
      <span className="absolute inset-0 flex items-center justify-center text-gray-200 text-sm sm:text-base">
        جارٍ التحميل...
      </span>
    </div>
  </motion.div>
);

// مكون علامة الصح المحسنة بتصميم جديد
const SuccessCheckmark = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.5 }}
    className="fixed inset-0 bg-gradient-to-br from-gray-900/60 to-zinc-800/60 flex items-center justify-center z-50 pointer-events-none"
  >
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 360 }}
      transition={{ type: 'spring', stiffness: 150, damping: 20, duration: 2 }}
      className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-[12px] p-8 sm:p-10 w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center shadow-xl border border-teal-200/50"
      style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} // شكل سداسي
    >
      <svg
        className="w-16 h-16 sm:w-18 sm:h-18 text-white"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          d="M12 2l2 7h7l-5 4 2 7-6-4-6 4 2-7-5-4h7z" // رمز نجمة
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
        />
      </svg>
    </motion.div>
  </motion.div>
);

const UploadFingerprint = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [searchCode, setSearchCode] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [isCreatingOfficialLeave, setIsCreatingOfficialLeave] = useState(false);
  const [isCreatingLeaveCompensation, setIsCreatingLeaveCompensation] = useState(false);
  const [isCreatingMedicalLeave, setIsCreatingMedicalLeave] = useState(false);
  const [isCreatingAnnualLeave, setIsCreatingAnnualLeave] = useState(false);
  const [officialLeaveDetails, setOfficialLeaveDetails] = useState({
    code: '',
    applyToAll: false,
    dateFrom: '',
    dateTo: '',
  });
  const [leaveCompensationDetails, setLeaveCompensationDetails] = useState({
    code: '',
    applyToAll: false,
    dateFrom: '',
    dateTo: '',
  });
  const [medicalLeaveDetails, setMedicalLeaveDetails] = useState({
    code: '',
    applyToAll: false,
    dateFrom: '',
    dateTo: '',
  });
  const [annualLeaveDetails, setAnnualLeaveDetails] = useState({
    code: '',
    applyToAll: false,
    dateFrom: '',
    dateTo: '',
  });
  const [loading, setLoading] = useState(false);
  const [showSingleFingerprint, setShowSingleFingerprint] = useState(false);
  const [showAbsenceDays, setShowAbsenceDays] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // دالة لإظهار علامة الصح لمدة 3 ثوانٍ
  const triggerSuccessAnimation = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    let filtered = reports;
    if (showSingleFingerprint) {
      filtered = filtered.filter(report => report.isSingleFingerprint === 'نعم');
    }
    if (showAbsenceDays) {
      filtered = filtered.filter(report => report.absence === 'نعم');
    }
    setFilteredReports(filtered);
    console.log(`Filtered reports: ${filtered.length}, Absence days shown: ${showAbsenceDays}, Single fingerprints shown: ${showSingleFingerprint}`);
  }, [reports, showSingleFingerprint, showAbsenceDays]);

  const isWeeklyLeaveDay = (date, workDaysPerWeek) => {
    const dayOfWeek = DateTime.fromJSDate(date, { zone: 'Africa/Cairo' }).weekday;
    return (workDaysPerWeek === 5 && (dayOfWeek === 5 || dayOfWeek === 6)) ||
           (workDaysPerWeek === 6 && dayOfWeek === 5);
  };

  const calculateTotals = () => {
    const totals = filteredReports.reduce(
      (acc, report) => {
        const isWeeklyLeave = isWeeklyLeaveDay(new Date(report.date), report.workDaysPerWeek || 6);
        const isWorkDay = !isWeeklyLeave &&
                         report.absence === 'لا' &&
                         report.annualLeave === 'لا' &&
                         report.medicalLeave === 'لا' &&
                         report.officialLeave === 'لا' &&
                         Number(report.leaveCompensation) === 0;
        const isAbsenceDay = report.absence === 'نعم';
        const isLateDay = (Number(report.lateDeduction) || 0) > 0;

        acc.totalWorkHours += Number(report.workHours) || 0;
        acc.totalWorkDays += isWorkDay ? 1 : 0;
        acc.totalAbsenceDays += isAbsenceDay ? 1 : 0;
        acc.totalLateDays += isLateDay ? 1 : 0;
        acc.totalDeductions += (Number(report.lateDeduction) || 0) +
                              (Number(report.earlyLeaveDeduction) || 0) +
                              (Number(report.medicalLeaveDeduction) || 0);
        acc.totalOvertime += Number(report.overtime) || 0;
        acc.totalWeeklyLeaveDays += isWeeklyLeave ? 1 : 0;
        acc.totalAnnualLeaveDays += report.annualLeave === 'نعم' ? 1 : 0;
        acc.totalMedicalLeaveDays += report.medicalLeave === 'نعم' ? 1 : 0;
        acc.totalOfficialLeaveDays += report.officialLeave === 'نعم' ? 1 : 0;
        acc.totalLeaveCompensationDays += Number(report.leaveCompensation) > 0 ? 1 : 0;
        acc.totalLeaveCompensationValue += Number(report.leaveCompensation) || 0;
        acc.annualLeaveBalance = Number(report.annualLeaveBalance) || 0;

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
        annualLeaveBalance: 0,
      }
    );

    console.log(`Calculated totals: Work Hours=${totals.totalWorkHours}, Work Days=${totals.totalWorkDays}, Absence Days=${totals.totalAbsenceDays}, Late Days=${totals.totalLateDays}, Deductions=${totals.totalDeductions}, Overtime=${totals.totalOvertime}, Weekly Leave=${totals.totalWeeklyLeaveDays}, Annual Leave=${totals.totalAnnualLeaveDays}, Medical Leave=${totals.totalMedicalLeaveDays}, Official Leave=${totals.totalOfficialLeaveDays}, Leave Compensation Days=${totals.totalLeaveCompensationDays}, Leave Compensation Value=${totals.totalLeaveCompensationValue}, Annual Leave Balance=${totals.annualLeaveBalance}`);

    return {
      totalWorkHours: totals.totalWorkHours.toFixed(2),
      totalWorkDays: totals.totalWorkDays,
      totalAbsenceDays: totals.totalAbsenceDays,
      totalLateDays: totals.totalLateDays,
      totalDeductions: totals.totalDeductions.toFixed(2),
      totalOvertime: totals.totalOvertime.toFixed(2),
      totalWeeklyLeaveDays: totals.totalWeeklyLeaveDays,
      totalAnnualLeaveDays: totals.totalAnnualLeaveDays,
      totalMedicalLeaveDays: totals.totalMedicalLeaveDays,
      totalOfficialLeaveDays: totals.totalOfficialLeaveDays,
      totalLeaveCompensationDays: totals.totalLeaveCompensationDays,
      totalLeaveCompensationValue: totals.totalLeaveCompensationValue.toFixed(2),
      annualLeaveBalance: totals.annualLeaveBalance,
    };
  };

  const totals = calculateTotals();

  if (!user || user.role !== 'admin') return null;

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setErrorMessage('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('يرجى اختيار ملف أولاً');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/fingerprints/upload`,
        fd,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setReports(res.data.reports);
      setFilteredReports(res.data.reports);
      setFile(null);
      setErrorMessage('');
      triggerSuccessAnimation();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      console.error('Error uploading file:', errorMsg);
      setErrorMessage(`خطأ أثناء رفع الملف: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchCode || !dateFrom || !dateTo) {
      setErrorMessage('يرجى إدخال كود الموظف وتاريخ البداية والنهاية');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/fingerprints`,
        {
          params: { code: searchCode, dateFrom, dateTo },
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      setReports(res.data.reports);
      setFilteredReports(res.data.reports);
      triggerSuccessAnimation();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      console.error('Error searching reports:', errorMsg);
      setErrorMessage(`خطأ أثناء البحث: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleShowAll = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const params = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/fingerprints`,
        {
          params,
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      setReports(res.data.reports);
      setFilteredReports(res.data.reports);
      setSearchCode('');
      triggerSuccessAnimation();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      console.error('Error fetching all reports:', errorMsg);
      setErrorMessage(`خطأ أثناء جلب جميع السجلات: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllFingerprints = async () => {
    if (!window.confirm('هل أنت متأكد من حذف جميع سجلات البصمات؟ هذه العملية لا يمكن التراجع عنها!')) {
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await axios.delete(
        `${process.env.REACT_APP_API_URL}/api/fingerprints/all`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setReports([]);
      setFilteredReports([]);
      setErrorMessage('');
      alert(`تم حذف ${res.data.deletedCount} سجل بصمة بنجاح`);
      triggerSuccessAnimation();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      console.error('Error deleting all fingerprints:', errorMsg);
      setErrorMessage(`خطأ أثناء الحذف: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditReport = (updatedReport) => {
    setReports((prev) =>
      prev.map((report) => (report._id === updatedReport._id ? updatedReport : report))
    );
    setFilteredReports((prev) =>
      prev.map((report) => (report._id === updatedReport._id ? updatedReport : report))
    );
    triggerSuccessAnimation();
  };

  const handleCreateOfficialLeave = async (e) => {
    e.preventDefault();
    if (!officialLeaveDetails.dateFrom || !officialLeaveDetails.dateTo) {
      setErrorMessage('يرجى إدخال تاريخ البداية والنهاية');
      return;
    }
    if (!officialLeaveDetails.applyToAll && !officialLeaveDetails.code) {
      setErrorMessage('يرجى إدخال كود الموظف أو اختيار تطبيق على الجميع');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const startDate = DateTime.fromISO(officialLeaveDetails.dateFrom, { zone: 'Africa/Cairo' });
      const endDate = DateTime.fromISO(officialLeaveDetails.dateTo, { zone: 'Africa/Cairo' });

      if (!startDate.isValid || !endDate.isValid) {
        throw new Error('تاريخ البداية أو النهاية غير صالح');
      }

      if (startDate > endDate) {
        throw new Error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      }

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/fingerprints/official-leave`,
        {
          code: officialLeaveDetails.applyToAll ? null : officialLeaveDetails.code,
          dateFrom: officialLeaveDetails.dateFrom,
          dateTo: officialLeaveDetails.dateTo,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      setReports((prev) => [
        ...prev.filter((r) => !response.data.reports.some((newR) => newR._id === r._id)),
        ...response.data.reports,
      ]);
      setFilteredReports((prev) => [
        ...prev.filter((r) => !response.data.reports.some((newR) => newR._id === r._id)),
        ...response.data.reports,
      ]);
      setIsCreatingOfficialLeave(false);
      setOfficialLeaveDetails({ code: '', applyToAll: false, dateFrom: '', dateTo: '' });
      setErrorMessage('');
      alert('تم إنشاء الإجازة الرسمية بنجاح');
      triggerSuccessAnimation();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      console.error('Error creating official leave:', errorMsg);
      setErrorMessage(`خطأ أثناء إنشاء الإجازة الرسمية: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLeaveCompensation = async (e) => {
    e.preventDefault();
    if (!leaveCompensationDetails.dateFrom || !leaveCompensationDetails.dateTo) {
      setErrorMessage('يرجى إدخال تاريخ البداية والنهاية');
      return;
    }
    if (!leaveCompensationDetails.applyToAll && !leaveCompensationDetails.code) {
      setErrorMessage('يرجى إدخال كود الموظف أو اختيار تطبيق على الجميع');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const startDate = DateTime.fromISO(leaveCompensationDetails.dateFrom, { zone: 'Africa/Cairo' });
      const endDate = DateTime.fromISO(leaveCompensationDetails.dateTo, { zone: 'Africa/Cairo' });

      if (!startDate.isValid || !endDate.isValid) {
        throw new Error('تاريخ البداية أو النهاية غير صالح');
      }

      if (startDate > endDate) {
        throw new Error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      }

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/fingerprints/leave-compensation`,
        {
          code: leaveCompensationDetails.applyToAll ? null : leaveCompensationDetails.code,
          dateFrom: leaveCompensationDetails.dateFrom,
          dateTo: leaveCompensationDetails.dateTo,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      setReports((prev) => [
        ...prev.filter((r) => !response.data.reports.some((newR) => newR._id === r._id)),
        ...response.data.reports,
      ]);
      setFilteredReports((prev) => [
        ...prev.filter((r) => !response.data.reports.some((newR) => newR._id === r._id)),
        ...response.data.reports,
      ]);
      setIsCreatingLeaveCompensation(false);
      setLeaveCompensationDetails({ code: '', applyToAll: false, dateFrom: '', dateTo: '' });
      setErrorMessage('');
      alert('تم إنشاء بدل الإجازة بنجاح');
      triggerSuccessAnimation();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      console.error('Error creating leave compensation:', errorMsg);
      setErrorMessage(`خطأ أثناء إنشاء بدل الإجازة: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMedicalLeave = async (e) => {
    e.preventDefault();
    if (!medicalLeaveDetails.dateFrom || !medicalLeaveDetails.dateTo) {
      setErrorMessage('يرجى إدخال تاريخ البداية والنهاية');
      return;
    }
    if (!medicalLeaveDetails.applyToAll && !medicalLeaveDetails.code) {
      setErrorMessage('يرجى إدخال كود الموظف أو اختيار تطبيق على الجميع');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const startDate = DateTime.fromISO(medicalLeaveDetails.dateFrom, { zone: 'Africa/Cairo' });
      const endDate = DateTime.fromISO(medicalLeaveDetails.dateTo, { zone: 'Africa/Cairo' });

      if (!startDate.isValid || !endDate.isValid) {
        throw new Error('تاريخ البداية أو النهاية غير صالح');
      }

      if (startDate > endDate) {
        throw new Error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      }

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/fingerprints/medical-leave`,
        {
          code: medicalLeaveDetails.applyToAll ? null : medicalLeaveDetails.code,
          dateFrom: medicalLeaveDetails.dateFrom,
          dateTo: medicalLeaveDetails.dateTo,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      setReports((prev) => [
        ...prev.filter((r) => !response.data.reports.some((newR) => newR._id === r._id)),
        ...response.data.reports,
      ]);
      setFilteredReports((prev) => [
        ...prev.filter((r) => !response.data.reports.some((newR) => newR._id === r._id)),
        ...response.data.reports,
      ]);
      setIsCreatingMedicalLeave(false);
      setMedicalLeaveDetails({ code: '', applyToAll: false, dateFrom: '', dateTo: '' });
      setErrorMessage('');
      alert('تم إنشاء الإجازة الطبية بنجاح');
      triggerSuccessAnimation();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      console.error('Error creating medical leave:', errorMsg);
      setErrorMessage(`خطأ أثناء إنشاء الإجازة الطبية: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnualLeave = async (e) => {
    e.preventDefault();
    if (!annualLeaveDetails.dateFrom || !annualLeaveDetails.dateTo) {
      setErrorMessage('يرجى إدخال تاريخ البداية والنهاية');
      return;
    }
    if (!annualLeaveDetails.applyToAll && !annualLeaveDetails.code) {
      setErrorMessage('يرجى إدخال كود الموظف أو اختيار تطبيق على الجميع');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const startDate = DateTime.fromISO(annualLeaveDetails.dateFrom, { zone: 'Africa/Cairo' });
      const endDate = DateTime.fromISO(annualLeaveDetails.dateTo, { zone: 'Africa/Cairo' });

      if (!startDate.isValid || !endDate.isValid) {
        throw new Error('تاريخ البداية أو النهاية غير صالح');
      }

      if (startDate > endDate) {
        throw new Error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      }

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/fingerprints/annual-leave`,
        {
          code: annualLeaveDetails.applyToAll ? null : annualLeaveDetails.code,
          dateFrom: annualLeaveDetails.dateFrom,
          dateTo: annualLeaveDetails.dateTo,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      setReports((prev) => [
        ...prev.filter((r) => !response.data.reports.some((newR) => newR._id === r._id)),
        ...response.data.reports,
      ]);
      setFilteredReports((prev) => [
        ...prev.filter((r) => !response.data.reports.some((newR) => newR._id === r._id)),
        ...response.data.reports,
      ]);
      setIsCreatingAnnualLeave(false);
      setAnnualLeaveDetails({ code: '', applyToAll: false, dateFrom: '', dateTo: '' });
      setErrorMessage('');
      alert('تم إنشاء الإجازة السنوية بنجاح');
      triggerSuccessAnimation();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      console.error('Error creating annual leave:', errorMsg);
      setErrorMessage(`خطأ أثناء إنشاء الإجازة السنوية: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOfficialLeaveChange = (e) => {
    const { name, value, type, checked } = e.target;
    setOfficialLeaveDetails((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleLeaveCompensationChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLeaveCompensationDetails((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleMedicalLeaveChange = (e) => {
    const { name, value, type, checked } = e.target;
    setMedicalLeaveDetails((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAnnualLeaveChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAnnualLeaveDetails((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <NavBar />
      <AnimatePresence>
        {loading && <LoadingSpinner />}
      </AnimatePresence>
      <div className="container mx-auto p-4 sm:p-6 max-w-full">
        {/* عرض رسالة الخطأ */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 text-red-600 p-3 sm:p-4 rounded-lg mb-4 sm:mb-6 text-right text-sm sm:text-base"
          >
            {errorMessage}
          </motion.div>
        )}

        {/* عرض علامة الصح عند النجاح */}
        <AnimatePresence>
          {showSuccess && <SuccessCheckmark />}
        </AnimatePresence>

        {/* قسم رفع ملف البصمات */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-200 mb-4 sm:mb-6"
        >
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 text-right">رفع ملف البصمات</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                اختر ملف Excel
              </label>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                disabled={loading}
              />
            </div>
            <motion.button
              type="submit"
              disabled={loading || !file}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-stone-700 text-white px-4 py-2 rounded-md hover:bg-stone-800 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-stone-700 ${
                loading || !file ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'جارٍ الرفع...' : 'رفع الملف'}
            </motion.button>
          </form>
        </motion.div>

        {/* قسم البحث */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-200 mb-4 sm:mb-6"
        >
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 text-right">البحث في التقارير</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                كود الموظف
              </label>
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                placeholder="أدخل كود الموظف"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                من تاريخ
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                إلى تاريخ
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                disabled={loading}
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 sm:gap-4 mt-4">
            <motion.button
              onClick={handleSearch}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-stone-700 text-white px-4 py-2 rounded-md hover:bg-stone-800 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-stone-700 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'جارٍ البحث...' : 'بحث'}
            </motion.button>
            <motion.button
              onClick={handleShowAll}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-zinc-600 text-white px-4 py-2 rounded-md hover:bg-zinc-700 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-zinc-600 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'جارٍ الجلب...' : 'عرض الكل'}
            </motion.button>
            <motion.button
              onClick={() => setIsCreatingOfficialLeave(true)}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-sky-600 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              إضافة إجازة رسمية
            </motion.button>
            <motion.button
              onClick={() => setIsCreatingLeaveCompensation(true)}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-amber-500 text-white px-4 py-2 rounded-md hover:bg-amber-600 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-amber-500 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              إضافة بدل إجازة
            </motion.button>
            <motion.button
              onClick={() => setIsCreatingMedicalLeave(true)}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-cyan-600 text-white px-4 py-2 rounded-md hover:bg-cyan-700 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-cyan-600 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              إضافة إجازة طبية
            </motion.button>
            <motion.button
              onClick={() => setIsCreatingAnnualLeave(true)}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-lime-500 text-white px-4 py-2 rounded-md hover:bg-lime-600 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-lime-500 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              إضافة إجازة سنوية
            </motion.button>
            <motion.button
              onClick={handleDeleteAllFingerprints}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-red-800 text-white px-4 py-2 rounded-md hover:bg-red-900 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-red-800 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              حذف جميع البصمات
            </motion.button>
          </div>
          <div className="flex flex-wrap justify-end gap-4 mt-4">
            <label className="flex items-center text-gray-700 text-sm font-medium">
              <input
                type="checkbox"
                checked={showSingleFingerprint}
                onChange={() => setShowSingleFingerprint(!showSingleFingerprint)}
                className="mr-2 accent-sky-600"
                disabled={loading}
              />
              عرض البصمات الفردية فقط
            </label>
            <label className="flex items-center text-gray-700 text-sm font-medium">
              <input
                type="checkbox"
                checked={showAbsenceDays}
                onChange={() => setShowAbsenceDays(!showAbsenceDays)}
                className="mr-2 accent-sky-600"
                disabled={loading}
              />
              عرض أيام الغياب فقط
            </label>
          </div>
        </motion.div>

        {/* نموذج إضافة إجازة رسمية */}
        <AnimatePresence>
          {isCreatingOfficialLeave && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 text-right">إضافة إجازة رسمية</h2>
                <form onSubmit={handleCreateOfficialLeave} className="space-y-4">
                  <div>
                    <label className="flex items-center text-gray-700 text-sm font-medium mb-2 text-right">
                      <input
                        type="checkbox"
                        name="applyToAll"
                        checked={officialLeaveDetails.applyToAll}
                        onChange={handleOfficialLeaveChange}
                        className="mr-2 accent-sky-600"
                        disabled={loading}
                      />
                      تطبيق على الجميع
                    </label>
                  </div>
                  {!officialLeaveDetails.applyToAll && (
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                        كود الموظف
                      </label>
                      <input
                        type="text"
                        name="code"
                        value={officialLeaveDetails.code}
                        onChange={handleOfficialLeaveChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                        placeholder="أدخل كود الموظف"
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      من تاريخ
                    </label>
                    <input
                      type="date"
                      name="dateFrom"
                      value={officialLeaveDetails.dateFrom}
                      onChange={handleOfficialLeaveChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      إلى تاريخ
                    </label>
                    <input
                      type="date"
                      name="dateTo"
                      value={officialLeaveDetails.dateTo}
                      onChange={handleOfficialLeaveChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 sm:gap-4">
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-auto bg-stone-700 text-white px-4 py-2 rounded-md hover:bg-stone-800 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-stone-700 ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {loading ? 'جارٍ الإنشاء...' : 'إنشاء'}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setIsCreatingOfficialLeave(false)}
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-auto bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-gray-500 ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      إلغاء
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* نموذج إضافة بدل إجازة */}
        <AnimatePresence>
          {isCreatingLeaveCompensation && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 text-right">إضافة بدل إجازة</h2>
                <form onSubmit={handleCreateLeaveCompensation} className="space-y-4">
                  <div>
                    <label className="flex items-center text-gray-700 text-sm font-medium mb-2 text-right">
                      <input
                        type="checkbox"
                        name="applyToAll"
                        checked={leaveCompensationDetails.applyToAll}
                        onChange={handleLeaveCompensationChange}
                        className="mr-2 accent-sky-600"
                        disabled={loading}
                      />
                      تطبيق على الجميع
                    </label>
                  </div>
                  {!leaveCompensationDetails.applyToAll && (
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                        كود الموظف
                      </label>
                      <input
                        type="text"
                        name="code"
                        value={leaveCompensationDetails.code}
                        onChange={handleLeaveCompensationChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                        placeholder="أدخل كود الموظف"
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      من تاريخ
                    </label>
                    <input
                      type="date"
                      name="dateFrom"
                      value={leaveCompensationDetails.dateFrom}
                      onChange={handleLeaveCompensationChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      إلى تاريخ
                    </label>
                    <input
                      type="date"
                      name="dateTo"
                      value={leaveCompensationDetails.dateTo}
                      onChange={handleLeaveCompensationChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 sm:gap-4">
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-auto bg-stone-700 text-white px-4 py-2 rounded-md hover:bg-stone-800 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-stone-700 ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {loading ? 'جارٍ الإنشاء...' : 'إنشاء'}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setIsCreatingLeaveCompensation(false)}
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-auto bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-gray-500 ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      إلغاء
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* نموذج إضافة إجازة طبية */}
        <AnimatePresence>
          {isCreatingMedicalLeave && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 text-right">إضافة إجازة طبية</h2>
                <form onSubmit={handleCreateMedicalLeave} className="space-y-4">
                  <div>
                    <label className="flex items-center text-gray-700 text-sm font-medium mb-2 text-right">
                      <input
                        type="checkbox"
                        name="applyToAll"
                        checked={medicalLeaveDetails.applyToAll}
                        onChange={handleMedicalLeaveChange}
                        className="mr-2 accent-sky-600"
                        disabled={loading}
                      />
                      تطبيق على الجميع
                    </label>
                  </div>
                  {!medicalLeaveDetails.applyToAll && (
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                        كود الموظف
                      </label>
                      <input
                        type="text"
                        name="code"
                        value={medicalLeaveDetails.code}
                        onChange={handleMedicalLeaveChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                        placeholder="أدخل كود الموظف"
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      من تاريخ
                    </label>
                    <input
                      type="date"
                      name="dateFrom"
                      value={medicalLeaveDetails.dateFrom}
                      onChange={handleMedicalLeaveChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      إلى تاريخ
                    </label>
                    <input
                      type="date"
                      name="dateTo"
                      value={medicalLeaveDetails.dateTo}
                      onChange={handleMedicalLeaveChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 sm:gap-4">
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-auto bg-stone-700 text-white px-4 py-2 rounded-md hover:bg-stone-800 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-stone-700 ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {loading ? 'جارٍ الإنشاء...' : 'إنشاء'}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setIsCreatingMedicalLeave(false)}
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-auto bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-gray-500 ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      إلغاء
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* نموذج إضافة إجازة سنوية */}
        <AnimatePresence>
          {isCreatingAnnualLeave && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 text-right">إضافة إجازة سنوية</h2>
                <form onSubmit={handleCreateAnnualLeave} className="space-y-4">
                  <div>
                    <label className="flex items-center text-gray-700 text-sm font-medium mb-2 text-right">
                      <input
                        type="checkbox"
                        name="applyToAll"
                        checked={annualLeaveDetails.applyToAll}
                        onChange={handleAnnualLeaveChange}
                        className="mr-2 accent-sky-600"
                        disabled={loading}
                      />
                      تطبيق على الجميع
                    </label>
                  </div>
                  {!annualLeaveDetails.applyToAll && (
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                        كود الموظف
                      </label>
                      <input
                        type="text"
                        name="code"
                        value={annualLeaveDetails.code}
                        onChange={handleAnnualLeaveChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                        placeholder="أدخل كود الموظف"
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      من تاريخ
                    </label>
                    <input
                      type="date"
                      name="dateFrom"
                      value={annualLeaveDetails.dateFrom}
                      onChange={handleAnnualLeaveChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      إلى تاريخ
                    </label>
                    <input
                      type="date"
                      name="dateTo"
                      value={annualLeaveDetails.dateTo}
                      onChange={handleAnnualLeaveChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-sky-300"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 sm:gap-4">
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-auto bg-stone-700 text-white px-4 py-2 rounded-md hover:bg-stone-800 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-stone-700 ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {loading ? 'جارٍ الإنشاء...' : 'إنشاء'}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setIsCreatingAnnualLeave(false)}
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-auto bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors duration-300 text-sm sm:text-base shadow-sm ring-1 ring-offset-1 ring-gray-500 ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      إلغاء
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* جدول التقارير */}
        {filteredReports.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-200 mb-4 sm:mb-6"
          >
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 text-right">التقارير</h2>
            <div className="overflow-x-auto">
              <ReportTable reports={filteredReports} onEdit={handleEditReport} />
            </div>
            <div className="mt-6 text-right">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-4">إجماليات الفترة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg shadow-inner">
                <div className="bg-sky-50 p-3 sm:p-4 rounded-lg text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي ساعات العمل</p>
                  <p className="text-sm sm:text-lg font-bold text-sky-700">{totals.totalWorkHours} ساعة</p>
                </div>
                <div className="bg-emerald-50 p-3 sm:p-4 rounded-lg text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام العمل</p>
                  <p className="text-sm sm:text-lg font-bold text-emerald-700">{totals.totalWorkDays} يوم</p>
                </div>
                <div className="bg-red-50 p-3 sm:p-4 rounded-lg text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام الغياب</p>
                  <p className="text-sm sm:text-lg font-bold text-red-700">{totals.totalAbsenceDays} يوم</p>
                </div>
                <div className="bg-amber-50 p-3 sm:p-4 rounded-lg text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام التأخير</p>
                  <p className="text-sm sm:text-lg font-bold text-amber-700">{totals.totalLateDays} يوم</p>
                </div>
                <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي الخصومات</p>
                  <p className="text-sm sm:text-lg font-bold text-yellow-700">{totals.totalDeductions} يوم</p>
                </div>
                <div className="bg-purple-50 p-3 sm:p-4 rounded-lg text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي الساعات الإضافية</p>
                  <p className="text-sm sm:text-lg font-bold text-purple-700">{totals.totalOvertime} ساعة</p>
                </div>
                <div className="bg-zinc-50 p-3 sm:p-4 rounded-lg text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام الإجازة الأسبوعية</p>
                  <p className="text-sm sm:text-lg font-bold text-zinc-700">{totals.totalWeeklyLeaveDays} يوم</p>
                </div>
                <div className="bg-lime-50 p-3 sm:p-4 rounded-lg text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام الإجازة السنوية</p>
                  <p className="text-sm sm:text-lg font-bold text-lime-700">{totals.totalAnnualLeaveDays} يوم</p>
                </div>
                <div className="bg-cyan-50 p-3 sm:p-4 rounded-lg text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام الإجازة الطبية</p>
                  <p className="text-sm sm:text-lg font-bold text-cyan-700">{totals.totalMedicalLeaveDays} يوم</p>
                </div>
                <div className="bg-teal-50 p-3 sm:p-4 rounded-lg text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام الإجازة الرسمية</p>
                  <p className="text-sm sm:text-lg font-bold text-teal-700">{totals.totalOfficialLeaveDays} يوم</p>
                </div>
                <div className="bg-amber-50 p-3 sm:p-4 rounded-lg text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي أيام بدل الإجازة</p>
                  <p className="text-sm sm:text-lg font-bold text-amber-700">{totals.totalLeaveCompensationDays} يوم</p>
                </div>
                <div className="bg-lime-50 p-3 sm:p-4 rounded-lg text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">إجمالي قيمة بدل الإجازة</p>
                  <p className="text-sm sm:text-lg font-bold text-lime-700">{totals.totalLeaveCompensationValue} جنيه</p>
                </div>
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg text-right">
                  <p className="text-xs sm:text-sm font-medium text-gray-600">رصيد الإجازات السنوية</p>
                  <p className="text-sm sm:text-lg font-bold text-gray-700">{totals.annualLeaveBalance} يوم</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default UploadFingerprint;
