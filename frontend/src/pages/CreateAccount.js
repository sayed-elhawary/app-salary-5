import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../components/AuthProvider';
import NavBar from '../components/NavBar';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

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
        className="bg-gradient-to-br from-green-400 to-emerald-300 p-8 rounded-full shadow-lg w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center"
      >
        <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  const { user } = useContext(AuthContext);
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
    <div className="min-h-screen">
      <NavBar />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 max-w-md mx-auto md:max-w-4xl"
      >
        <h1 className="text-2xl md:text-3xl font-bold mb-6 text-center">إنشاء حساب جديد</h1>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">الكود الوظيفي</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  required
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">الاسم الكامل</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">كلمة المرور</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">القسم</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">الراتب الأساسي</label>
                <input
                  type="number"
                  value={form.baseSalary}
                  onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  required
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">الحافز الأساسي</label>
                <input
                  type="number"
                  value={form.baseBonus}
                  onChange={(e) => setForm({ ...form, baseBonus: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">نسبة الحافز (%)</label>
                <input
                  type="number"
                  value={form.bonusPercentage}
                  onChange={(e) => setForm({ ...form, bonusPercentage: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  required
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">بدل وجبة</label>
                <input
                  type="number"
                  value={form.mealAllowance}
                  onChange={(e) => setForm({ ...form, mealAllowance: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">قيمة التأمين الطبي</label>
                <input
                  type="number"
                  value={form.medicalInsurance}
                  onChange={(e) => setForm({ ...form, medicalInsurance: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">قيمة التأمين الاجتماعي</label>
                <input
                  type="number"
                  value={form.socialInsurance}
                  onChange={(e) => setForm({ ...form, socialInsurance: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">عدد أيام العمل</label>
                <select
                  value={form.workDaysPerWeek}
                  onChange={(e) => setForm({ ...form, workDaysPerWeek: parseInt(e.target.value) })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                >
                  <option value={5}>5 أيام</option>
                  <option value={6}>6 أيام</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">حالة الحساب</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                  <option value="suspended">معلق</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">رصيد الإجازة السنوية</label>
                <input
                  type="number"
                  value={form.annualLeaveBalance}
                  onChange={(e) => setForm({ ...form, annualLeaveBalance: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">الإجازة السنوية المخصصة</label>
                <input
                  type="number"
                  value={form.customAnnualLeave}
                  onChange={(e) => setForm({ ...form, customAnnualLeave: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">حافز العيد</label>
                <input
                  type="number"
                  value={form.eidBonus}
                  onChange={(e) => setForm({ ...form, eidBonus: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">قيمة الجزاءات</label>
                <input
                  type="number"
                  value={form.penaltiesValue}
                  onChange={(e) => setForm({ ...form, penaltiesValue: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">قسط المخالفات</label>
                <input
                  type="number"
                  value={form.violationsInstallment}
                  onChange={(e) => setForm({ ...form, violationsInstallment: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">إجمالي قيمة المخالفات</label>
                <input
                  type="number"
                  value={form.totalViolationsValue}
                  onChange={(e) => setForm({ ...form, totalViolationsValue: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">السلف</label>
                <input
                  type="number"
                  value={form.advances}
                  onChange={(e) => setForm({ ...form, advances: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">إجمالي أيام الإجازة الرسمية</label>
                <input
                  type="number"
                  value={form.totalOfficialLeaveDays}
                  onChange={(e) => setForm({ ...form, totalOfficialLeaveDays: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">رصيد السماح الشهري (دقائق)</label>
                <input
                  type="number"
                  value={form.monthlyLateAllowance}
                  onChange={(e) => setForm({ ...form, monthlyLateAllowance: e.target.value })}
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm md:text-base">الراتب الصافي (يُحسب تلقائياً)</label>
                <input
                  type="number"
                  value={netSalary.toFixed(2)}
                  readOnly
                  className="w-full p-4 border rounded-lg min-w-[200px] text-lg bg-gray-100 text-gray-700"
                />
              </div>
            </div>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-4 mt-6 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-lg transition-colors duration-300"
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
