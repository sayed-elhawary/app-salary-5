import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../components/AuthProvider';
import NavBar from '../components/NavBar';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

// مكون مؤشر التحميل
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

// مكون علامة الصح
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

const CreateAccount = () => {
  const { user, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    code: '',
    fullName: '',
    password: '',
    department: '',
    baseSalary: '',
    baseBonus: '',
    bonusPercentage: '',
    mealAllowance: '',
    medicalInsurance: 0,
    socialInsurance: 0,
    workDaysPerWeek: 5,
    status: 'active',
    annualLeaveBalance: 21,
    eidBonus: 0,
    penaltiesValue: 0,
    violationsInstallment: 0,
    totalViolationsValue: 0,
    advances: 0,
    totalOfficialLeaveDays: 0,
    monthlyLateAllowance: 120,
    customAnnualLeave: 0,
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const netSalary =
    Number(form.baseSalary || 0) +
    Number(form.baseBonus || 0) * (Number(form.bonusPercentage || 0) / 100) +
    Number(form.mealAllowance || 0) -
    Number(form.medicalInsurance || 0) -
    Number(form.socialInsurance || 0) -
    Number(form.penaltiesValue || 0) -
    Number(form.violationsInstallment || 0) -
    Number(form.advances || 0) +
    Number(form.eidBonus || 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <AnimatePresence>
          <LoadingSpinner />
        </AnimatePresence>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    navigate('/login');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/users`,
        { ...form, createdBy: user._id },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      setShowSuccess(true);
      setForm({
        code: '',
        fullName: '',
        password: '',
        department: '',
        baseSalary: '',
        baseBonus: '',
        bonusPercentage: '',
        mealAllowance: '',
        medicalInsurance: 0,
        socialInsurance: 0,
        workDaysPerWeek: 5,
        status: 'active',
        annualLeaveBalance: 21,
        eidBonus: 0,
        penaltiesValue: 0,
        violationsInstallment: 0,
        totalViolationsValue: 0,
        advances: 0,
        totalOfficialLeaveDays: 0,
        monthlyLateAllowance: 120,
        customAnnualLeave: 0,
      });
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      alert(`❌ خطأ أثناء إنشاء الحساب: ${error.response?.data?.message || error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-amiri">
      <NavBar />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="p-4 sm:p-6 max-w-3xl mx-auto"
      >
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 text-center mb-6">إنشاء حساب جديد</h1>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">الكود الوظيفي</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  required
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">الاسم الكامل</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">كلمة المرور</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">القسم</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">الراتب الأساسي</label>
                <input
                  type="number"
                  value={form.baseSalary}
                  onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  required
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">الحافز الأساسي</label>
                <input
                  type="number"
                  value={form.baseBonus}
                  onChange={(e) => setForm({ ...form, baseBonus: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">نسبة الحافز (%)</label>
                <input
                  type="number"
                  value={form.bonusPercentage}
                  onChange={(e) => setForm({ ...form, bonusPercentage: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  required
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">بدل وجبة</label>
                <input
                  type="number"
                  value={form.mealAllowance}
                  onChange={(e) => setForm({ ...form, mealAllowance: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">قيمة التأمين الطبي</label>
                <input
                  type="number"
                  value={form.medicalInsurance}
                  onChange={(e) => setForm({ ...form, medicalInsurance: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">قيمة التأمين الاجتماعي</label>
                <input
                  type="number"
                  value={form.socialInsurance}
                  onChange={(e) => setForm({ ...form, socialInsurance: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">عدد أيام العمل</label>
                <select
                  value={form.workDaysPerWeek}
                  onChange={(e) => setForm({ ...form, workDaysPerWeek: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                >
                  <option value={5}>5 أيام</option>
                  <option value={6}>6 أيام</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">حالة الحساب</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                  <option value="suspended">معلق</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">رصيد الإجازة السنوية</label>
                <input
                  type="number"
                  value={form.annualLeaveBalance}
                  onChange={(e) => setForm({ ...form, annualLeaveBalance: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">الإجازة السنوية المخصصة</label>
                <input
                  type="number"
                  value={form.customAnnualLeave}
                  onChange={(e) => setForm({ ...form, customAnnualLeave: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">حافز العيد</label>
                <input
                  type="number"
                  value={form.eidBonus}
                  onChange={(e) => setForm({ ...form, eidBonus: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">قيمة الجزاءات</label>
                <input
                  type="number"
                  value={form.penaltiesValue}
                  onChange={(e) => setForm({ ...form, penaltiesValue: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">قسط المخالفات</label>
                <input
                  type="number"
                  value={form.violationsInstallment}
                  onChange={(e) => setForm({ ...form, violationsInstallment: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">إجمالي قيمة المخالفات</label>
                <input
                  type="number"
                  value={form.totalViolationsValue}
                  onChange={(e) => setForm({ ...form, totalViolationsValue: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">السلف</label>
                <input
                  type="number"
                  value={form.advances}
                  onChange={(e) => setForm({ ...form, advances: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">إجمالي أيام الإجازة الرسمية</label>
                <input
                  type="number"
                  value={form.totalOfficialLeaveDays}
                  onChange={(e) => setForm({ ...form, totalOfficialLeaveDays: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">رصيد السماح الشهري (دقائق)</label>
                <input
                  type="number"
                  value={form.monthlyLateAllowance}
                  onChange={(e) => setForm({ ...form, monthlyLateAllowance: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">الراتب الصافي (يُحسب تلقائياً)</label>
                <input
                  type="number"
                  value={netSalary.toFixed(2)}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                />
              </div>
            </div>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-teal-500 text-white px-4 py-2 rounded-md hover:bg-teal-600 transition-all duration-200 text-sm font-medium shadow-sm"
            >
              إنشاء الحساب
            </motion.button>
          </form>
        </div>
        <AnimatePresence>
          {showSuccess && <SuccessCheckmark onComplete={() => setShowSuccess(false)} />}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default CreateAccount;
