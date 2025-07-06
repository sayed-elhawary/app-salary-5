import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../components/AuthProvider';
import { UserPlusIcon, UploadIcon, DollarSignIcon, SettingsIcon } from 'lucide-react';
import { motion } from 'framer-motion';

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
  hover: { scale: 1.05, transition: { duration: 0.3 } },
};

const Dashboard = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex items-center space-x-2">
          <svg
            className="animate-spin h-8 w-8 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8h8a8 8 0 01-8 8 8 8 0 01-8-8z"
            ></path>
          </svg>
          <span className="text-gray-600">جاري التحميل...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-red-500">يرجى تسجيل الدخول للوصول إلى لوحة التحكم</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-4xl md:text-5xl font-bold text-gray-800 text-center mb-12"
        >
          لوحة التحكم
        </motion.h1>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {user?.role === 'admin' && (
            <motion.div variants={cardVariants} whileHover="hover">
              <Link
                to="/create-account"
                className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center space-x-4 border border-gray-100 group"
              >
                <UserPlusIcon className="h-10 w-10 text-blue-500 group-hover:text-blue-700 transition-colors duration-300" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">إنشاء حساب</h2>
                  <p className="text-gray-500 mt-1 text-sm">إضافة موظف جديد إلى النظام</p>
                </div>
              </Link>
            </motion.div>
          )}
          <motion.div variants={cardVariants} whileHover="hover">
            <Link
              to="/upload-fingerprint"
              className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center space-x-4 border border-gray-100 group"
            >
              <UploadIcon className="h-10 w-10 text-blue-500 group-hover:text-blue-700 transition-colors duration-300" />
              <div>
                <h2 className="text-xl font-semibold text-gray-800">رفع بصمة</h2>
                <p className="text-gray-500 mt-1 text-sm">رفع ملف بصمة الموظفين</p>
              </div>
            </Link>
          </motion.div>
          {user?.role === 'admin' && (
            <motion.div variants={cardVariants} whileHover="hover">
              <Link
                to="/users/settings"
                className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center space-x-4 border border-gray-100 group"
              >
                <SettingsIcon className="h-10 w-10 text-blue-500 group-hover:text-blue-700 transition-colors duration-300" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">إعدادات المستخدم</h2>
                  <p className="text-gray-500 mt-1 text-sm">تعديل إعدادات حسابات الموظفين</p>
                </div>
              </Link>
            </motion.div>
          )}
          {user?.role === 'admin' && (
            <motion.div variants={cardVariants} whileHover="hover">
              <Link
                to="/monthly-salary-report"
                className="bg-white p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center space-x-4 border border-gray-100 group"
              >
                <DollarSignIcon className="h-10 w-10 text-blue-500 group-hover:text-blue-700 transition-colors duration-300" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">تقرير المرتب الشهري</h2>
                  <p className="text-gray-500 mt-1 text-sm">عرض تقرير المرتبات الشهرية للموظفين</p>
                </div>
              </Link>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
