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
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchCode, setSearchCode] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
    }
  }, [user, navigate]);

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
      console.error('Error fetching all users:', err.response?.data?.message || err.message);
      setError(`خطأ أثناء جلب جميع المستخدمين: ${err.response?.data?.message || err.message}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (userData) => {
    setEditingUser(userData);
    setEditForm({
      code: userData.code,
      employeeName: userData.employeeName,
      department: userData.department,
      baseSalary: userData.baseSalary || '0.00',
      medicalInsurance: userData.medicalInsurance || '0.00',
      socialInsurance: userData.socialInsurance || '0.00',
      annualLeaveBalance: userData.annualLeaveBalance || '21',
      eidBonus: userData.eidBonus || '0.00',
      advances: userData.advances || '0.00',
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

      await axios.put(
        `${process.env.REACT_APP_API_URL}/api/users/${editForm.code}`,
        {
          code: editForm.code,
          employeeName: editForm.employeeName,
          department: editForm.department,
          baseSalary: parseFloat(editForm.baseSalary),
          medicalInsurance: parseFloat(editForm.medicalInsurance),
          socialInsurance: parseFloat(editForm.socialInsurance),
          annualLeaveBalance: parseFloat(editForm.annualLeaveBalance),
          eidBonus: parseFloat(editForm.eidBonus),
          advances: parseFloat(editForm.advances),
          createdBy: user._id,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );

      setUsers((prev) =>
        prev.map((u) =>
          u.code === editForm.code
            ? {
                ...u,
                ...editForm,
                baseSalary: parseFloat(editForm.baseSalary).toFixed(2),
                medicalInsurance: parseFloat(editForm.medicalInsurance).toFixed(2),
                socialInsurance: parseFloat(editForm.socialInsurance).toFixed(2),
                annualLeaveBalance: parseFloat(editForm.annualLeaveBalance).toFixed(0),
                eidBonus: parseFloat(editForm.eidBonus).toFixed(2),
                advances: parseFloat(editForm.advances).toFixed(2),
              }
            : u
        )
      );

      setEditingUser(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      console.error('Error updating user:', err.response?.data?.message || err.message);
      setError(`خطأ أثناء التعديل: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCancel = () => {
    setEditingUser(null);
    setEditForm({});
    setError('');
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
                      'التأمين الطبي',
                      'التأمين الاجتماعي',
                      'رصيد الإجازة السنوية',
                      'العيدية',
                      'السلف',
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
                      <td className="p-3 text-gray-700">{userData.employeeName}</td>
                      <td className="p-3 text-gray-700">{userData.department}</td>
                      <td className="p-3 text-gray-700">{parseFloat(userData.baseSalary || 0).toFixed(2)}</td>
                      <td className="p-3 text-gray-700">{parseFloat(userData.medicalInsurance || 0).toFixed(2)}</td>
                      <td className="p-3 text-gray-700">{parseFloat(userData.socialInsurance || 0).toFixed(2)}</td>
                      <td className="p-3 text-gray-700 text-center">{parseInt(userData.annualLeaveBalance || 21, 10)}</td>
                      <td className="p-3 text-gray-700">{parseFloat(userData.eidBonus || 0).toFixed(2)}</td>
                      <td className="p-3 text-gray-700">{parseFloat(userData.advances || 0).toFixed(2)}</td>
                      <td className="p-3">
                        <motion.button
                          onClick={() => handleEditClick(userData)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="bg-teal-500 text-white px-4 py-2 rounded-md hover:bg-teal-600 transition-all duration-200 text-sm font-medium shadow-sm"
                        >
                          تعديل
                        </motion.button>
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
