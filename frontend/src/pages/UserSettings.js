import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../components/AuthProvider';
import NavBar from '../components/NavBar';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { SettingsIcon } from 'lucide-react';

const UserSettings = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchCode, setSearchCode] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleSearch = async () => {
    if (!searchCode) {
      setError('يرجى إدخال كود الموظف');
      setSuccess('');
      return;
    }

    setError('');
    setSuccess('');
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
    setSuccess('');
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
    setSuccess('');
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
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
      setSuccess('تم حفظ التعديلات بنجاح');
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
    setSuccess('');
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <div className="container mx-auto p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100 mb-6"
        >
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 text-right flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-blue-500" />
            إعدادات المستخدم
          </h2>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-right text-sm"
            >
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-green-100 text-green-700 p-3 rounded-md mb-4 text-right text-sm"
            >
              {success}
            </motion.div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                كود الموظف
              </label>
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="أدخل كود الموظف"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2 sm:gap-4 mt-4 sm:mt-8">
              <motion.button
                onClick={handleSearch}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors duration-300 text-sm ${
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
                className={`bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 transition-colors duration-300 text-sm ${
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
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full max-w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 text-right flex items-center gap-2">
                  <SettingsIcon className="h-6 w-6 text-blue-500" />
                  تعديل بيانات المستخدم
                </h2>
                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-right text-sm"
                  >
                    {error}
                  </motion.div>
                )}
                {success && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-green-100 text-green-700 p-3 rounded-md mb-4 text-right text-sm"
                  >
                    {success}
                  </motion.div>
                )}
                <form onSubmit={handleEditSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      كود الموظف
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={editForm.code}
                      onChange={handleEditChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      الاسم الكامل
                    </label>
                    <input
                      type="text"
                      name="employeeName"
                      value={editForm.employeeName}
                      onChange={handleEditChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      القسم
                    </label>
                    <input
                      type="text"
                      name="department"
                      value={editForm.department}
                      onChange={handleEditChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      الراتب الأساسي
                    </label>
                    <input
                      type="number"
                      name="baseSalary"
                      value={editForm.baseSalary}
                      onChange={handleEditChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      التأمين الطبي
                    </label>
                    <input
                      type="number"
                      name="medicalInsurance"
                      value={editForm.medicalInsurance}
                      onChange={handleEditChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      التأمين الاجتماعي
                    </label>
                    <input
                      type="number"
                      name="socialInsurance"
                      value={editForm.socialInsurance}
                      onChange={handleEditChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      رصيد الإجازة السنوية
                    </label>
                    <input
                      type="number"
                      name="annualLeaveBalance"
                      value={editForm.annualLeaveBalance}
                      onChange={handleEditChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      العيدية
                    </label>
                    <input
                      type="number"
                      name="eidBonus"
                      value={editForm.eidBonus}
                      onChange={handleEditChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2 text-right">
                      السلف
                    </label>
                    <input
                      type="number"
                      name="advances"
                      value={editForm.advances}
                      onChange={handleEditChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-4">
                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors duration-300 text-sm ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {loading ? 'جارٍ الحفظ...' : 'حفظ'}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleEditCancel}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors duration-300 text-sm"
                    >
                      إلغاء
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {users.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100"
          >
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 text-right flex items-center gap-2">
              <SettingsIcon className="h-6 w-6 text-blue-500" />
              قائمة المستخدمين
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      كود الموظف
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الاسم
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      القسم
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الراتب الأساسي
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      التأمين الطبي
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      التأمين الاجتماعي
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      رصيد الإجازة السنوية
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      العيدية
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      السلف
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((userData, index) => (
                    <tr key={index}>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm">{userData.code}</td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm">{userData.employeeName}</td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm">{userData.department}</td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm">{parseFloat(userData.baseSalary || 0).toFixed(2)}</td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm">{parseFloat(userData.medicalInsurance || 0).toFixed(2)}</td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm">{parseFloat(userData.socialInsurance || 0).toFixed(2)}</td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm">{parseInt(userData.annualLeaveBalance || 21, 10)}</td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm">{parseFloat(userData.eidBonus || 0).toFixed(2)}</td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm">{parseFloat(userData.advances || 0).toFixed(2)}</td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm">
                        <motion.button
                          onClick={() => handleEditClick(userData)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="bg-yellow-500 text-white px-3 py-1 rounded-md hover:bg-yellow-600 transition-colors duration-300 text-xs sm:text-sm"
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-100 text-center"
          >
            <p className="text-gray-700 text-sm sm:text-base">لا توجد بيانات مستخدمين متاحة. يرجى البحث أو عرض جميع المستخدمين.</p>
          </motion.div>
        )}

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center items-center mt-6"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default UserSettings;
