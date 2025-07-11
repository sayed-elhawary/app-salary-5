import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../components/AuthProvider';
import NavBar from '../components/NavBar';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { SettingsIcon } from 'lucide-react';

const SuccessCheckmark = ({ onComplete }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      onAnimationComplete={onComplete}
      className="fixed inset-0 flex items-center justify-center z-50"
    >
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          transition: { duration: 1.5, repeat: Infinity, repeatType: 'loop' },
        }}
        className="relative w-20 h-20"
      >
        <svg className="w-full h-full text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    className="fixed inset-0 flex items-center justify-center z-50"
  >
    <motion.div
      className="relative flex items-center justify-center"
      animate={{ rotate: 360 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
    >
      <svg className="w-16 h-16" viewBox="0 0 50 50">
        <motion.circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#06b6d4"
          strokeWidth="4"
          strokeDasharray="80 200"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-sm font-medium text-teal-600 font-amiri">
        جارٍ التحميل
      </span>
    </motion.div>
  </motion.div>
);

const UserSettings = () => {
  const { user, logout } = useContext(AuthContext); // إضافة logout من AuthContext
  const navigate = useNavigate();
  const [searchCode, setSearchCode] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [bulkUpdateForm, setBulkUpdateForm] = useState({
    monthlyLateAllowanceChange: '0',
    baseSalaryPercentage: '0',
    baseBonusIncrement: '0',
    medicalInsurance: '',
    socialInsurance: '',
    excludedUsers: [],
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
    } else {
      handleShowAll();
    }
  }, [user, navigate]);

  const handleTokenError = (err) => {
    if (err.response?.status === 401) {
      console.error('Token expired or invalid, logging out');
      logout(); // تسجيل الخروج
      navigate('/login');
      return true;
    }
    return false;
  };

  const handleSearch = async () => {
    if (!searchCode) {
      setError('يرجى إدخال كود الموظف');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/users`, {
        params: { code: searchCode },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setUsers(res.data.users || [res.data]);
    } catch (err) {
      if (handleTokenError(err)) return;
      console.error('Error fetching user:', err.response?.data?.message || err.message);
      setError(`خطأ أثناء البحث: ${err.response?.data?.message || err.message}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleShowAll = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setUsers(res.data.users || res.data);
      setSearchCode('');
    } catch (err) {
      if (handleTokenError(err)) return;
      console.error('Error fetching all users:', err.response?.data?.message || err.message);
      setError(`خطأ أثناء جلب جميع المستخدمين: ${err.response?.data?.message || err.message}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (userData) => {
    console.log('handleEditClick - userData:', userData);
    if (!userData || !userData.code) {
      console.error('Invalid userData:', userData);
      setError('خطأ: بيانات المستخدم غير صالحة');
      return;
    }
    setEditingUser(userData);
    setEditForm({
      code: userData.code || '',
      employeeName: userData.employeeName || userData.fullName || '',
      department: userData.department || '',
      baseSalary: userData.baseSalary ? parseFloat(userData.baseSalary).toFixed(2) : '0.00',
      medicalInsurance: userData.medicalInsurance ? parseFloat(userData.medicalInsurance).toFixed(2) : '0.00',
      socialInsurance: userData.socialInsurance ? parseFloat(userData.socialInsurance).toFixed(2) : '0.00',
      annualLeaveBalance: userData.annualLeaveBalance ? parseInt(userData.annualLeaveBalance, 10).toString() : '21',
      eidBonus: userData.eidBonus ? parseFloat(userData.eidBonus).toFixed(2) : '0.00',
      advances: userData.advances ? parseFloat(userData.advances).toFixed(2) : '0.00',
      monthlyLateAllowance: userData.monthlyLateAllowance ? parseInt(userData.monthlyLateAllowance, 10).toString() : '120',
      mealAllowance: userData.mealAllowance ? parseFloat(userData.mealAllowance).toFixed(2) : '500.00',
      password: '', // دائمًا فارغ لمنع إرسال كلمة مرور مُجزأة
    });
    setError('');
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // التحقق من الحقول الرقمية
      if (parseFloat(editForm.baseSalary) < 0) {
        setError('الراتب الأساسي لا يمكن أن يكون سالبًا');
        setLoading(false);
        return;
      }
      if (parseFloat(editForm.medicalInsurance) < 0) {
        setError('التأمين الطبي لا يمكن أن يكون سالبًا');
        setLoading(false);
        return;
      }
      if (parseFloat(editForm.socialInsurance) < 0) {
        setError('التأمين الاجتماعي لا يمكن أن يكون سالبًا');
        setLoading(false);
        return;
      }
      if (parseFloat(editForm.annualLeaveBalance) < 0) {
        setError('رصيد الإجازة السنوية لا يمكن أن يكون سالبًا');
        setLoading(false);
        return;
      }
      if (parseFloat(editForm.eidBonus) < 0) {
        setError('العيدية لا يمكن أن تكون سالبة');
        setLoading(false);
        return;
      }
      if (parseFloat(editForm.advances) < 0) {
        setError('السلف لا يمكن أن تكون سالبة');
        setLoading(false);
        return;
      }
      if (parseFloat(editForm.monthlyLateAllowance) < 0) {
        setError('رصيد السماح الشهري لا يمكن أن يكون سالبًا');
        setLoading(false);
        return;
      }
      if (parseFloat(editForm.mealAllowance) < 0) {
        setError('بدل الوجبة لا يمكن أن يكون سالبًا');
        setLoading(false);
        return;
      }
      if (editForm.password && editForm.password.length < 6) {
        setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        setLoading(false);
        return;
      }
      if (editForm.password && (editForm.password.startsWith('$2a$') || editForm.password.startsWith('$2b$'))) {
        setError('كلمة المرور يجب أن تكون نصًا عاديًا، وليس تجزئة');
        setLoading(false);
        return;
      }

      const updateData = {
        code: editForm.code,
        employeeName: editForm.employeeName,
        department: editForm.department,
        baseSalary: parseFloat(editForm.baseSalary),
        medicalInsurance: parseFloat(editForm.medicalInsurance),
        socialInsurance: parseFloat(editForm.socialInsurance),
        annualLeaveBalance: parseInt(editForm.annualLeaveBalance, 10),
        eidBonus: parseFloat(editForm.eidBonus),
        advances: parseFloat(editForm.advances),
        monthlyLateAllowance: parseInt(editForm.monthlyLateAllowance, 10),
        mealAllowance: parseFloat(editForm.mealAllowance),
        createdBy: user._id,
      };

      if (editForm.password) {
        console.log('Sending password for update:', editForm.password);
        updateData.password = editForm.password;
      } else {
        console.log('No password provided for update');
      }

      console.log('Sending update data:', updateData);

      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/api/users/${editForm.code}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );

      console.log('Update response:', response.data);

      setUsers((prev) =>
        prev.map((u) =>
          u.code === editForm.code
            ? {
                ...u,
                fullName: editForm.employeeName,
                department: editForm.department,
                baseSalary: parseFloat(editForm.baseSalary).toFixed(2),
                medicalInsurance: parseFloat(editForm.medicalInsurance).toFixed(2),
                socialInsurance: parseFloat(editForm.socialInsurance).toFixed(2),
                annualLeaveBalance: parseInt(editForm.annualLeaveBalance, 10).toString(),
                eidBonus: parseFloat(editForm.eidBonus).toFixed(2),
                advances: parseFloat(editForm.advances).toFixed(2),
                monthlyLateAllowance: parseInt(editForm.monthlyLateAllowance, 10).toString(),
                mealAllowance: parseFloat(editForm.mealAllowance).toFixed(2),
              }
            : u
        )
      );

      setEditingUser(null);
      setShowSuccess(true);
      if (editForm.password && response.data.message.includes('تم تحديث كلمة المرور')) {
        alert('تم تحديث كلمة المرور بنجاح. يرجى استخدام كلمة المرور الجديدة لتسجيل الدخول.');
      }
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      if (handleTokenError(err)) return;
      console.error('Error updating user:', err.response?.data?.message || err.message, err.stack);
      setError(
        err.response?.data?.message === 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
          ? 'كلمة المرور المدخلة قصيرة جدًا. يرجى إدخال 6 أحرف على الأقل.'
          : err.response?.data?.message === 'كلمة المرور يجب أن تكون نصًا عاديًا، وليس تجزئة'
          ? 'كلمة المرور يجب أن تكون نصًا عاديًا، وليس تجزئة.'
          : err.response?.data?.message === 'خطأ أثناء تشفير كلمة المرور'
          ? 'فشل تحديث كلمة المرور بسبب مشكلة في التشفير. حاول مرة أخرى.'
          : `خطأ أثناء التعديل: ${err.response?.data?.message || err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditCancel = () => {
    setEditingUser(null);
    setEditForm({});
    setError('');
  };

  const handleDeleteClick = (userData) => {
    setShowDeleteConfirm(userData);
  };

  const handleDeleteConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/users/${showDeleteConfirm.code}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setUsers((prev) => prev.filter((u) => u.code !== showDeleteConfirm.code));
      setShowDeleteConfirm(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      if (handleTokenError(err)) return;
      console.error('Error deleting user:', err.response?.data?.message || err.message);
      setError(`خطأ أثناء الحذف: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(null);
    setError('');
  };

  const handleBulkUpdateChange = (e) => {
    const { name, value } = e.target;
    setBulkUpdateForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleExcludedUsersChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map((option) => option.value);
    setBulkUpdateForm((prev) => ({ ...prev, excludedUsers: selectedOptions }));
  };

  const handleBulkUpdateSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { monthlyLateAllowanceChange, baseSalaryPercentage, baseBonusIncrement, medicalInsurance, socialInsurance, excludedUsers } = bulkUpdateForm;

      if (!monthlyLateAllowanceChange && !baseSalaryPercentage && !baseBonusIncrement && !medicalInsurance && !socialInsurance) {
        setError('يرجى إدخال قيمة واحدة على الأقل للتعديل');
        setLoading(false);
        return;
      }

      if (monthlyLateAllowanceChange && isNaN(parseFloat(monthlyLateAllowanceChange))) {
        setError('رصيد السماح الشهري يجب أن يكون رقمًا');
        setLoading(false);
        return;
      }

      if (baseSalaryPercentage && (isNaN(parseFloat(baseSalaryPercentage)) || parseFloat(baseSalaryPercentage) < 0)) {
        setError('نسبة الراتب الأساسي يجب أن تكون رقمًا موجبًا');
        setLoading(false);
        return;
      }

      if (baseBonusIncrement && (isNaN(parseFloat(baseBonusIncrement)) || parseFloat(baseBonusIncrement) < 0)) {
        setError('زيادة الحافز الأساسي يجب أن تكون رقمًا موجبًا');
        setLoading(false);
        return;
      }

      if (medicalInsurance && (isNaN(parseFloat(medicalInsurance)) || parseFloat(medicalInsurance) < 0)) {
        setError('التأمين الطبي يجب أن يكون رقمًا موجبًا');
        setLoading(false);
        return;
      }

      if (socialInsurance && (isNaN(parseFloat(socialInsurance)) || parseFloat(socialInsurance) < 0)) {
        setError('التأمين الاجتماعي يجب أن يكون رقمًا موجبًا');
        setLoading(false);
        return;
      }

      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/users/bulk-update`,
        {
          monthlyLateAllowanceChange: parseFloat(monthlyLateAllowanceChange) || 0,
          baseSalaryPercentage: parseFloat(baseSalaryPercentage) || 0,
          baseBonusIncrement: parseFloat(baseBonusIncrement) || 0,
          medicalInsurance: medicalInsurance ? parseFloat(medicalInsurance) : undefined,
          socialInsurance: socialInsurance ? parseFloat(socialInsurance) : undefined,
          excludedUsers,
          createdBy: user._id,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );

      setUsers(res.data.users);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      setBulkUpdateForm({
        monthlyLateAllowanceChange: '0',
        baseSalaryPercentage: '0',
        baseBonusIncrement: '0',
        medicalInsurance: '',
        socialInsurance: '',
        excludedUsers: [],
      });
    } catch (err) {
      if (handleTokenError(err)) return;
      console.error('Error in bulk update:', err.response?.data?.message || err.message);
      setError(`خطأ أثناء التعديل الجماعي: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-amiri">
      <NavBar />
      <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
        <AnimatePresence>
          {loading && <LoadingSpinner />}
        </AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6"
        >
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6 text-right flex items-center gap-3">
            <SettingsIcon className="h-6 w-6 text-teal-500" />
            إعدادات المستخدم
          </h2>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-right text-sm font-medium"
            >
              {error}
            </motion.div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                كود الموظف
              </label>
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                placeholder="أدخل كود الموظف"
                disabled={loading}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-3 mt-4 sm:mt-8">
              <motion.button
                onClick={handleSearch}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full sm:w-auto bg-teal-500 text-white px-5 py-2.5 rounded-md hover:bg-teal-600 transition-all duration-200 text-sm font-medium shadow-sm ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'جارٍ البحث...' : 'بحث'}
              </motion.button>
              <motion.button
                onClick={handleShowAll}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full sm:w-auto bg-teal-500 text-white px-5 py-2.5 rounded-md hover:bg-teal-600 transition-all duration-200 text-sm font-medium shadow-sm ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'جارٍ الجلب...' : 'عرض الكل'}
              </motion.button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6"
        >
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6 text-right flex items-center gap-3">
            <SettingsIcon className="h-6 w-6 text-teal-500" />
            تعديل جماعي للمستخدمين
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                تغيير رصيد السماح الشهري (دقائق، يمكن أن يكون سالبًا)
              </label>
              <input
                type="number"
                name="monthlyLateAllowanceChange"
                value={bulkUpdateForm.monthlyLateAllowanceChange}
                onChange={handleBulkUpdateChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                نسبة زيادة الراتب الأساسي (%)
              </label>
              <input
                type="number"
                name="baseSalaryPercentage"
                value={bulkUpdateForm.baseSalaryPercentage}
                onChange={handleBulkUpdateChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                min="0"
                step="0.01"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                زيادة الحافز الأساسي
              </label>
              <input
                type="number"
                name="baseBonusIncrement"
                value={bulkUpdateForm.baseBonusIncrement}
                onChange={handleBulkUpdateChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                min="0"
                step="0.01"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                التأمين الطبي (قيمة جديدة)
              </label>
              <input
                type="number"
                name="medicalInsurance"
                value={bulkUpdateForm.medicalInsurance}
                onChange={handleBulkUpdateChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                min="0"
                step="0.01"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                التأمين الاجتماعي (قيمة جديدة)
              </label>
              <input
                type="number"
                name="socialInsurance"
                value={bulkUpdateForm.socialInsurance}
                onChange={handleBulkUpdateChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                min="0"
                step="0.01"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                استثناء مستخدمين (اختيار متعدد)
              </label>
              <select
                multiple
                name="excludedUsers"
                value={bulkUpdateForm.excludedUsers}
                onChange={handleExcludedUsersChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                disabled={loading}
              >
                {users.map((userData) => (
                  <option key={userData.code} value={userData.code}>
                    {userData.fullName} ({userData.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-3">
              <motion.button
                onClick={handleBulkUpdateSubmit}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full sm:w-auto bg-teal-500 text-white px-5 py-2.5 rounded-md hover:bg-teal-600 transition-all duration-200 text-sm font-medium shadow-sm ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'جارٍ التعديل...' : 'تطبيق التعديلات الجماعية'}
              </motion.button>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {editingUser && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6 text-right flex items-center gap-3">
                  <SettingsIcon className="h-6 w-6 text-teal-500" />
                  تعديل بيانات المستخدم
                </h2>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-right text-sm font-medium"
                  >
                    {error}
                  </motion.div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      كود الموظف
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={editForm.code}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm bg-gray-50 cursor-not-allowed"
                      required
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      الاسم الكامل
                    </label>
                    <input
                      type="text"
                      name="employeeName"
                      value={editForm.employeeName}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      القسم
                    </label>
                    <input
                      type="text"
                      name="department"
                      value={editForm.department}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      الراتب الأساسي
                    </label>
                    <input
                      type="number"
                      name="baseSalary"
                      value={editForm.baseSalary}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                      required
                      min="0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      التأمين الطبي
                    </label>
                    <input
                      type="number"
                      name="medicalInsurance"
                      value={editForm.medicalInsurance}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                      min="0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      التأمين الاجتماعي
                    </label>
                    <input
                      type="number"
                      name="socialInsurance"
                      value={editForm.socialInsurance}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                      min="0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      رصيد الإجازة السنوية
                    </label>
                    <input
                      type="number"
                      name="annualLeaveBalance"
                      value={editForm.annualLeaveBalance}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                      min="0"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      العيدية
                    </label>
                    <input
                      type="number"
                      name="eidBonus"
                      value={editForm.eidBonus}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                      min="0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      السلف
                    </label>
                    <input
                      type="number"
                      name="advances"
                      value={editForm.advances}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                      min="0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      رصيد السماح الشهري (دقائق)
                    </label>
                    <input
                      type="number"
                      name="monthlyLateAllowance"
                      value={editForm.monthlyLateAllowance}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                      min="0"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      بدل الوجبة
                    </label>
                    <input
                      type="number"
                      name="mealAllowance"
                      value={editForm.mealAllowance}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                      min="0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      كلمة المرور (اتركها فارغة لعدم التغيير)
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={editForm.password}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                      placeholder="أدخل كلمة المرور الجديدة"
                      disabled={loading}
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-3">
                    <motion.button
                      onClick={handleEditSubmit}
                      disabled={loading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full sm:w-auto bg-teal-500 text-white px-5 py-2.5 rounded-md hover:bg-teal-600 transition-all duration-200 text-sm font-medium shadow-sm ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {loading ? 'جارٍ الحفظ...' : 'حفظ'}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleEditCancel}
                      disabled={loading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full sm:w-auto bg-gray-500 text-white px-5 py-2.5 rounded-md hover:bg-gray-600 transition-all duration-200 text-sm font-medium shadow-sm ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      إلغاء
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-bold text-gray-900 mb-4 text-right">
                  تأكيد حذف المستخدم
                </h2>
                <p className="text-gray-600 text-sm mb-6 text-right">
                  هل أنت متأكد من حذف المستخدم {showDeleteConfirm.fullName} (كود: {showDeleteConfirm.code})؟
                </p>
                <div className="flex justify-end gap-3">
                  <motion.button
                    onClick={handleDeleteConfirm}
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`bg-red-500 text-white px-5 py-2.5 rounded-md hover:bg-red-600 transition-all duration-200 text-sm font-medium shadow-sm ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {loading ? 'جارٍ الحذف...' : 'حذف'}
                  </motion.button>
                  <motion.button
                    onClick={handleDeleteCancel}
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`bg-gray-500 text-white px-5 py-2.5 rounded-md hover:bg-gray-600 transition-all duration-200 text-sm font-medium shadow-sm ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    إلغاء
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSuccess && <SuccessCheckmark onComplete={() => setShowSuccess(false)} />}
        </AnimatePresence>

        {users.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
          >
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6 text-right flex items-center gap-3">
              <SettingsIcon className="h-6 w-6 text-teal-500" />
              قائمة المستخدمين
            </h2>
            <div className="overflow-x-auto max-h-[60vh] rounded-lg">
              <table className="w-full text-right text-sm border-collapse" dir="rtl">
                <thead>
                  <tr className="bg-teal-500 text-white sticky top-0 z-10">
                    {[
                      'كود الموظف',
                      'الاسم',
                      'القسم',
                      'الراتب الأساسي',
                      'الحافز الأساسي',
                      'التأمين الطبي',
                      'التأمين الاجتماعي',
                      'رصيد الإجازة السنوية',
                      'العيدية',
                      'السلف',
                      'رصيد السماح الشهري',
                      'بدل الوجبة',
                      'إجراءات',
                    ].map((header) => (
                      <th
                        key={header}
                        className="p-3 font-semibold text-sm border-b border-gray-200 whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((userData, index) => (
                    <tr
                      key={index}
                      className={`${
                        index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      } hover:bg-teal-50 transition-all duration-200 border-b border-gray-100`}
                    >
                      <td className="p-3 text-gray-700 whitespace-nowrap">{userData.code}</td>
                      <td className="p-3 text-gray-700">{userData.fullName}</td>
                      <td className="p-3 text-gray-700">{userData.department}</td>
                      <td className="p-3 text-gray-700">{parseFloat(userData.baseSalary || 0).toFixed(2)}</td>
                      <td className="p-3 text-gray-700">{parseFloat(userData.baseBonus || 0).toFixed(2)}</td>
                      <td className="p-3 text-gray-700">{parseFloat(userData.medicalInsurance || 0).toFixed(2)}</td>
                      <td className="p-3 text-gray-700">{parseFloat(userData.socialInsurance || 0).toFixed(2)}</td>
                      <td className="p-3 text-gray-700 text-center">{parseInt(userData.annualLeaveBalance || 21, 10)}</td>
                      <td className="p-3 text-gray-700">{parseFloat(userData.eidBonus || 0).toFixed(2)}</td>
                      <td className="p-3 text-gray-700">{parseFloat(userData.advances || 0).toFixed(2)}</td>
                      <td className="p-3 text-gray-700">{parseInt(userData.monthlyLateAllowance || 120, 10)}</td>
                      <td className="p-3 text-gray-700">{parseFloat(userData.mealAllowance || 500).toFixed(2)}</td>
                      <td className="p-3 flex gap-2">
                        <motion.button
                          onClick={() => handleEditClick(userData)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="bg-teal-500 text-white px-4 py-2 rounded-md hover:bg-teal-600 transition-all duration-200 text-sm font-medium shadow-sm"
                        >
                          تعديل
                        </motion.button>
                        {userData.role !== 'admin' && (
                          <motion.button
                            onClick={() => handleDeleteClick(userData)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-all duration-200 text-sm font-medium shadow-sm"
                          >
                            حذف
                          </motion.button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {users.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center"
          >
            <p className="text-gray-600 text-sm font-medium">
              لا توجد بيانات مستخدمين متاحة. يرجى البحث أو عرض جميع المستخدمين.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default UserSettings;
