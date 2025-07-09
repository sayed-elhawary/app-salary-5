import { Link, useNavigate } from 'react-router-dom';
import { useState, useContext, useEffect } from 'react';
import { AuthContext } from './AuthProvider';
import { HomeIcon, UserPlusIcon, UploadIcon, LogOutIcon, DollarSignIcon, SettingsIcon, GiftIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

// مؤشر التحميل الدائري
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

const Navbar = () => {
  const { user, setUser, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loading && !user) {
      const token = localStorage.getItem('token');
      if (token) {
        axios
          .get(`${process.env.REACT_APP_API_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .then((response) => {
            setUser(response.data.user);
          })
          .catch((err) => {
            console.error('Error fetching user:', err.message);
            setError('فشل تحميل بيانات المستخدم');
            localStorage.removeItem('token');
            navigate('/login');
          });
      }
    }
  }, [loading, user, setUser, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
    setIsOpen(false);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white shadow-sm sticky top-0 z-50"
      >
        <div className="max-w-6xl mx-auto px-4 py-4">
          <p className="text-red-600 text-sm font-amiri text-right">{error}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 font-amiri">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link
              to="/dashboard"
              className="flex items-center space-x-2 text-teal-500 text-xl font-bold hover:text-teal-600 transition-all duration-300"
            >
              <HomeIcon className="h-6 w-6" />
              <span>نظام الحضور</span>
            </Link>
          </div>
          <div className="hidden sm:flex sm:items-center sm:gap-x-2">
            <Link
              to="/dashboard"
              className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300"
            >
              <HomeIcon className="h-5 w-5" />
              <span>الرئيسية</span>
            </Link>
            {user?.role === 'admin' && (
              <>
                <Link
                  to="/create-account"
                  className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300"
                >
                  <UserPlusIcon className="h-5 w-5" />
                  <span>إنشاء حساب</span>
                </Link>
                <Link
                  to="/upload-fingerprint"
                  className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300"
                >
                  <UploadIcon className="h-5 w-5" />
                  <span>رفع بصمة</span>
                </Link>
                <Link
                  to="/users/settings"
                  className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300"
                >
                  <SettingsIcon className="h-5 w-5" />
                  <span>إعدادات المستخدم</span>
                </Link>
              </>
            )}
            <Link
              to="/monthly-salary-report"
              className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300"
            >
              <DollarSignIcon className="h-5 w-5" />
              <span>تقرير المرتب الشهري</span>
            </Link>
            <Link
              to="/monthly-bonus-report"
              className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300"
            >
              <GiftIcon className="h-5 w-5" />
              <span>تقرير الحافز الشهري</span>
            </Link>
            {user ? (
              <motion.button
                onClick={handleLogout}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center space-x-2 text-white bg-red-500 hover:bg-red-600 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300"
              >
                <LogOutIcon className="h-5 w-5" />
                <span>تسجيل الخروج</span>
              </motion.button>
            ) : (
              <Link
                to="/login"
                className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300"
              >
                <span>تسجيل الدخول</span>
              </Link>
            )}
          </div>
          <div className="flex items-center sm:hidden">
            <motion.button
              onClick={() => setIsOpen(!isOpen)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all duration-300"
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </motion.button>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="sm:hidden bg-gray-50"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="pt-2 pb-4 space-y-2 px-4">
              <Link
                to="/dashboard"
                className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-4 py-3 rounded-md text-base font-medium transition-all duration-300"
                onClick={() => setIsOpen(false)}
              >
                <HomeIcon className="h-5 w-5" />
                <span>الرئيسية</span>
              </Link>
              {user?.role === 'admin' && (
                <>
                  <Link
                    to="/create-account"
                    className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-4 py-3 rounded-md text-base font-medium transition-all duration-300"
                    onClick={() => setIsOpen(false)}
                  >
                    <UserPlusIcon className="h-5 w-5" />
                    <span>إنشاء حساب</span>
                  </Link>
                  <Link
                    to="/upload-fingerprint"
                    className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-4 py-3 rounded-md text-base font-medium transition-all duration-300"
                    onClick={() => setIsOpen(false)}
                  >
                    <UploadIcon className="h-5 w-5" />
                    <span>رفع بصمة</span>
                  </Link>
                  <Link
                    to="/users/settings"
                    className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-4 py-3 rounded-md text-base font-medium transition-all duration-300"
                    onClick={() => setIsOpen(false)}
                  >
                    <SettingsIcon className="h-5 w-5" />
                    <span>إعدادات المستخدم</span>
                  </Link>
                </>
              )}
              <Link
                to="/monthly-salary-report"
                className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-4 py-3 rounded-md text-base font-medium transition-all duration-300"
                onClick={() => setIsOpen(false)}
              >
                <DollarSignIcon className="h-5 w-5" />
                <span>تقرير المرتب الشهري</span>
              </Link>
              <Link
                to="/monthly-bonus-report"
                className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-4 py-3 rounded-md text-base font-medium transition-all duration-300"
                onClick={() => setIsOpen(false)}
              >
                <GiftIcon className="h-5 w-5" />
                <span>تقرير الحافز الشهري</span>
              </Link>
              {user ? (
                <motion.button
                  onClick={handleLogout}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center space-x-2 text-white bg-red-500 hover:bg-red-600 px-4 py-3 rounded-md text-base font-medium transition-all duration-300 w-full text-right"
                >
                  <LogOutIcon className="h-5 w-5" />
                  <span>تسجيل الخروج</span>
                </motion.button>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 hover:bg-gray-100 px-4 py-3 rounded-md text-base font-medium transition-all duration-300"
                  onClick={() => setIsOpen(false)}
                >
                  <span>تسجيل الدخول</span>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
