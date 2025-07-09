import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../components/AuthProvider';
import { HomeIcon, UserPlusIcon, UploadIcon, DollarSignIcon, SettingsIcon, GiftIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  hover: { scale: 1.02, transition: { duration: 0.3 } },
};

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

const Dashboard = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <AnimatePresence>
          <LoadingSpinner />
        </AnimatePresence>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-red-500 text-sm font-amiri">يرجى تسجيل الدخول للوصول إلى لوحة التحكم</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 font-amiri">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8"
        >
          لوحة التحكم
        </motion.h1>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {user?.role === 'admin' && (
            <>
              <motion.div variants={cardVariants} whileHover="hover">
                <Link
                  to="/create-account"
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-4 group hover:bg-gray-50 transition-all duration-200"
                >
                  <UserPlusIcon className="h-8 w-8 text-teal-500 group-hover:text-teal-600 transition-colors duration-200" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">إنشاء حساب</h2>
                    <p className="text-gray-500 text-sm mt-1">إضافة موظف جديد إلى النظام</p>
                  </div>
                </Link>
              </motion.div>
              <motion.div variants={cardVariants} whileHover="hover">
                <Link
                  to="/upload-fingerprint"
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-4 group hover:bg-gray-50 transition-all duration-200"
                >
                  <UploadIcon className="h-8 w-8 text-teal-500 group-hover:text-teal-600 transition-colors duration-200" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">رفع بصمة</h2>
                    <p className="text-gray-500 text-sm mt-1">رفع ملف بصمة الموظفين</p>
                  </div>
                </Link>
              </motion.div>
              <motion.div variants={cardVariants} whileHover="hover">
                <Link
                  to="/users/settings"
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-4 group hover:bg-gray-50 transition-all duration-200"
                >
                  <SettingsIcon className="h-8 w-8 text-teal-500 group-hover:text-teal-600 transition-colors duration-200" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">إعدادات المستخدم</h2>
                    <p className="text-gray-500 text-sm mt-1">تعديل إعدادات حسابات الموظفين</p>
                  </div>
                </Link>
              </motion.div>
            </>
          )}
          <motion.div variants={cardVariants} whileHover="hover">
            <Link
              to="/monthly-salary-report"
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-4 group hover:bg-gray-50 transition-all duration-200"
            >
              <DollarSignIcon className="h-8 w-8 text-teal-500 group-hover:text-teal-600 transition-colors duration-200" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">تقرير المرتب الشهري</h2>
                <p className="text-gray-500 text-sm mt-1">عرض تقرير المرتبات الشهرية للموظفين</p>
              </div>
            </Link>
          </motion.div>
          <motion.div variants={cardVariants} whileHover="hover">
            <Link
              to="/monthly-bonus-report"
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center space-x-4 group hover:bg-gray-50 transition-all duration-200"
            >
              <GiftIcon className="h-8 w-8 text-teal-500 group-hover:text-teal-600 transition-colors duration-200" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">تقرير الحافز الشهري</h2>
                <p className="text-gray-500 text-sm mt-1">عرض تقرير الحوافز الشهرية للموظفين</p>
              </div>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
