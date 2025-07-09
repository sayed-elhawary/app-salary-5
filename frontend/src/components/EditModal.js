import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { DateTime } from 'luxon';

const EditModal = ({ report, isOpen, onClose, onUpdate }) => {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [absence, setAbsence] = useState(false);
  const [annualLeave, setAnnualLeave] = useState(false);
  const [medicalLeave, setMedicalLeave] = useState(false);
  const [officialLeave, setOfficialLeave] = useState(false);
  const [leaveCompensation, setLeaveCompensation] = useState(false);
  const [appropriateValue, setAppropriateValue] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [annualLeaveBalance, setAnnualLeaveBalance] = useState(report?.annualLeaveBalance || 0);

  // تحميل البيانات من السجل عند فتح النموذج
  useEffect(() => {
    if (report) {
      setCheckIn(report.checkIn ? DateTime.fromISO(report.checkIn, { zone: 'Africa/Cairo' }).toFormat('HH:mm:ss') : '');
      setCheckOut(report.checkOut ? DateTime.fromISO(report.checkOut, { zone: 'Africa/Cairo' }).toFormat('HH:mm:ss') : '');
      setAbsence(report.absence === 'نعم' || report.absence === true);
      setAnnualLeave(report.annualLeave === 'نعم' || report.annualLeave === true);
      setMedicalLeave(report.medicalLeave === 'نعم' || report.medicalLeave === true);
      setOfficialLeave(report.officialLeave === 'نعم' || report.officialLeave === true);
      setLeaveCompensation(
        report.leaveCompensation && report.leaveCompensation !== 'لا' && parseFloat(report.leaveCompensation) > 0
      );
      setAppropriateValue(
        report.appropriateValue && report.appropriateValue !== 'لا' ? parseFloat(report.appropriateValue) : 0
      );
      setAnnualLeaveBalance(report.annualLeaveBalance || 0);
      setError('');
    }
  }, [report]);

  // تعطيل حقول الوقت عند اختيار إجازة سنوية
  useEffect(() => {
    if (annualLeave) {
      setCheckIn('');
      setCheckOut('');
    }
  }, [annualLeave]);

  // إلغاء الحالات الأخرى عند اختيار حالة معينة
  const handleCheckboxChange = (field) => (e) => {
    const value = e.target.checked;
    setAbsence(field === 'absence' ? value : false);
    setAnnualLeave(field === 'annualLeave' ? value : false);
    setMedicalLeave(field === 'medicalLeave' ? value : false);
    setOfficialLeave(field === 'officialLeave' ? value : false);
    setLeaveCompensation(field === 'leaveCompensation' ? value : false);
    setAppropriateValue(field === 'appropriateValue' && value ? 1 : 0);
  };

  // التحقق من رصيد الإجازة السنوية
  const checkAnnualLeaveBalance = async () => {
    if (!annualLeave) return true;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/${report.code}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.user.annualLeaveBalance <= 0) {
        setError('رصيد الإجازة السنوية غير كافٍ');
        toast.error('رصيد الإجازة السنوية غير كافٍ');
        return false;
      }
      setAnnualLeaveBalance(response.data.user.annualLeaveBalance);
      return true;
    } catch (err) {
      console.error('Error checking annual leave balance:', err.response?.data || err.message);
      setError('خطأ في التحقق من رصيد الإجازة السنوية');
      toast.error('خطأ في التحقق من رصيد الإجازة السنوية');
      return false;
    }
  };

  // إرسال التعديلات
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // التحقق من تنسيق الوقت
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
    if (!annualLeave && ((checkIn && !timeRegex.test(checkIn)) || (checkOut && !timeRegex.test(checkOut)))) {
      setError('تنسيق الوقت غير صالح، يجب أن يكون HH:mm أو HH:mm:ss');
      toast.error('تنسيق الوقت غير صالح');
      setLoading(false);
      return;
    }

    // التحقق من الحالات الحصرية
    if ([absence, annualLeave, medicalLeave, officialLeave, leaveCompensation, appropriateValue > 0].filter(Boolean).length > 1) {
      setError('لا يمكن تحديد أكثر من حالة واحدة (غياب، إجازة سنوية، إجازة طبية، إجازة رسمية، بدل إجازة، قيمة مناسبة)');
      toast.error('لا يمكن تحديد أكثر من حالة واحدة');
      setLoading(false);
      return;
    }

    // التحقق من رصيد الإجازة السنوية
    if (annualLeave && !(await checkAnnualLeaveBalance())) {
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('التوكن غير موجود، يرجى تسجيل الدخول');
      }

      // تحويل التاريخ والوقت إلى تنسيق ISO
      const date = DateTime.fromISO(report.date, { zone: 'Africa/Cairo' }).toISODate();
      const checkInISO = annualLeave || absence || medicalLeave || officialLeave || leaveCompensation || appropriateValue > 0
        ? null
        : checkIn
        ? DateTime.fromISO(`${report.date}T${checkIn}`, { zone: 'Africa/Cairo' }).toISO()
        : null;
      const checkOutISO = annualLeave || absence || medicalLeave || officialLeave || leaveCompensation || appropriateValue > 0
        ? null
        : checkOut
        ? DateTime.fromISO(`${report.date}T${checkOut}`, { zone: 'Africa/Cairo' }).toISO()
        : null;

      const payload = {
        code: report.code,
        date,
        checkIn: checkInISO,
        checkOut: checkOutISO,
        absence,
        annualLeave,
        medicalLeave,
        officialLeave,
        leaveCompensation, // نرسل قيمة منطقية، الخادم هيحسب القيمة
        appropriateValue,
      };
      console.log('Submitting payload:', payload);

      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/api/fingerprints/${report._id}`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      console.log('Update response:', response.data);
      setAnnualLeaveBalance(response.data.annualLeaveBalance); // تحديث رصيد الإجازة
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onUpdate({ ...response.data.report, annualLeaveBalance: response.data.annualLeaveBalance });
        toast.success(response.data.message || 'تم حفظ التعديلات بنجاح');
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error saving report:', err.response?.data || err.message);
      const errorMsg = err.response?.data?.message || 'خطأ في حفظ التعديلات';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !report) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {showSuccess ? (
        <motion.div
          className="flex items-center justify-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <svg
            className="w-24 h-24 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <motion.circle
              cx="12"
              cy="12"
              r="10"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            />
            <motion.path
              d="M9 12l2 2 4-4"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3, ease: 'easeInOut' }}
            />
          </svg>
        </motion.div>
      ) : (
        <motion.div
          className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-lg"
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4 text-right">تعديل سجل الحضور</h2>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-right mb-4 text-sm"
            >
              {error}
            </motion.p>
          )}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1 text-right">كود الموظف</label>
                <input
                  type="text"
                  value={report.code}
                  readOnly
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-right text-sm"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1 text-right">اسم الموظف</label>
                <input
                  type="text"
                  value={report.employeeName}
                  readOnly
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-right text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1 text-right">تاريخ الحضور</label>
              <input
                type="text"
                value={report.date}
                readOnly
                className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-right text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1 text-right">رصيد الإجازة السنوية</label>
              <input
                type="text"
                value={annualLeaveBalance}
                readOnly
                className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-right text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1 text-right">توقيت الحضور</label>
                <input
                  type="time"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-right text-sm"
                  step="1"
                  disabled={loading || annualLeave || absence || medicalLeave || officialLeave || leaveCompensation || appropriateValue > 0}
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1 text-right">توقيت الانصراف</label>
                <input
                  type="time"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-right text-sm"
                  step="1"
                  disabled={loading || annualLeave || absence || medicalLeave || officialLeave || leaveCompensation || appropriateValue > 0}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="flex items-center justify-end">
                <label className="text-gray-700 text-sm font-medium mr-2">الغياب</label>
                <input
                  type="checkbox"
                  checked={absence}
                  onChange={handleCheckboxChange('absence')}
                  className="h-4 w-4"
                  disabled={loading}
                />
              </div>
              <div className="flex items-center justify-end">
                <label className="text-gray-700 text-sm font-medium mr-2">إجازة سنوية</label>
                <input
                  type="checkbox"
                  checked={annualLeave}
                  onChange={handleCheckboxChange('annualLeave')}
                  className="h-4 w-4"
                  disabled={loading}
                />
              </div>
              <div className="flex items-center justify-end">
                <label className="text-gray-700 text-sm font-medium mr-2">إجازة طبية</label>
                <input
                  type="checkbox"
                  checked={medicalLeave}
                  onChange={handleCheckboxChange('medicalLeave')}
                  className="h-4 w-4"
                  disabled={loading}
                />
              </div>
              <div className="flex items-center justify-end">
                <label className="text-gray-700 text-sm font-medium mr-2">إجازة رسمية</label>
                <input
                  type="checkbox"
                  checked={officialLeave}
                  onChange={handleCheckboxChange('officialLeave')}
                  className="h-4 w-4"
                  disabled={loading}
                />
              </div>
              <div className="flex items-center justify-end">
                <label className="text-gray-700 text-sm font-medium mr-2">بدل الإجازة</label>
                <input
                  type="checkbox"
                  checked={leaveCompensation}
                  onChange={handleCheckboxChange('leaveCompensation')}
                  className="h-4 w-4"
                  disabled={loading}
                />
              </div>
              <div className="flex items-center justify-end">
                <label className="text-gray-700 text-sm font-medium mr-2">قيمة مناسبة</label>
                <input
                  type="checkbox"
                  checked={appropriateValue > 0}
                  onChange={handleCheckboxChange('appropriateValue')}
                  className="h-4 w-4"
                  disabled={loading}
                />
              </div>
            </div>
            {appropriateValue > 0 && (
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1 text-right">القيمة المناسبة</label>
                <input
                  type="number"
                  value={appropriateValue}
                  onChange={(e) => setAppropriateValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border rounded-lg text-right text-sm"
                  min="0"
                  step="0.01"
                  disabled={loading}
                />
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2 sm:gap-4">
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.05 }}
                whileTap={{ scale: loading ? 1 : 0.95 }}
                className={`w-full sm:w-auto bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-800 transition-colors duration-300 text-sm sm:text-base ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? 'جارٍ الحفظ...' : 'حفظ'}
              </motion.button>
              <motion.button
                type="button"
                onClick={onClose}
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.05 }}
                whileTap={{ scale: loading ? 1 : 0.95 }}
                className={`w-full sm:w-auto bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors duration-300 text-sm sm:text-base ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                إلغاء
              </motion.button>
            </div>
          </form>
        </motion.div>
      )}
    </motion.div>
  );
};

export default EditModal;
