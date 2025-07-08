import { Link, useNavigate } from 'react-router-dom';
import { useState, useContext, useEffect } from 'react';
import { AuthContext } from './AuthProvider';
import { HomeIcon, UserPlusIcon, UploadIcon, LogOutIcon, DollarSignIcon, SettingsIcon, GiftIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

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
    return (
      <div className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-gray-600 text-right">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-red-500 text-right">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link
              to="/dashboard"
              className="flex items-center space-x-2 text-blue-600 text-2xl font-bold hover:text-blue-800 transition-all duration-300"
            >
              <HomeIcon className="h-6 w-6" />
              <span>نظام الحضور</span>
            </Link>
          </div>
          <div className="hidden sm:flex sm:items-center sm:space-x-4">
            <Link
              to="/dashboard"
              className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105"
            >
              <HomeIcon className="h-5 w-5" />
              <span>الرئيسية</span>
            </Link>
            {user?.role === 'admin' && (
              <>
                <Link
                  to="/create-account"
                  className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105"
                >
                  <UserPlusIcon className="h-5 w-5" />
                  <span>إنشاء حساب</span>
                </Link>
                <Link
                  to="/upload-fingerprint"
                  className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105"
                >
                  <UploadIcon className="h-5 w-5" />
                  <span>رفع بصمة</span>
                </Link>
                <Link
                  to="/users/settings"
                  className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105"
                >
                  <SettingsIcon className="h-5 w-5" />
                  <span>إعدادات المستخدم</span>
                </Link>
              </>
            )}
            <Link
              to="/monthly-salary-report"
              className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105"
            >
              <DollarSignIcon className="h-5 w-5" />
              <span>تقرير المرتب الشهري</span>
            </Link>
            <Link
              to="/monthly-bonus-report"
              className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105"
            >
              <GiftIcon className="h-5 w-5" />
              <span>تقرير الحافز الشهري</span>
            </Link>
            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-white bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105"
              >
                <LogOutIcon className="h-5 w-5" />
                <span>تسجيل الخروج</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105"
              >
                <span>تسجيل الدخول</span>
              </Link>
            )}
          </div>
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
      {isOpen && (
        <motion.div
          className="sm:hidden bg-gray-50"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="pt-2 pb-4 space-y-2 px-4">
            <Link
              to="/dashboard"
              className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 block px-4 py-3 rounded-lg text-base font-medium transition-all duration-300"
              onClick={() => setIsOpen(false)}
            >
              <HomeIcon className="h-5 w-5" />
              <span>الرئيسية</span>
            </Link>
            {user?.role === 'admin' && (
              <>
                <Link
                  to="/create-account"
                  className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 block px-4 py-3 rounded-lg text-base font-medium transition-all duration-300"
                  onClick={() => setIsOpen(false)}
                >
                  <UserPlusIcon className="h-5 w-5" />
                  <span>إنشاء حساب</span>
                </Link>
                <Link
                  to="/upload-fingerprint"
                  className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 block px-4 py-3 rounded-lg text-base font-medium transition-all duration-300"
                  onClick={() => setIsOpen(false)}
                >
                  <UploadIcon className="h-5 w-5" />
                  <span>رفع بصمة</span>
                </Link>
                <Link
                  to="/users/settings"
                  className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 block px-4 py-3 rounded-lg text-base font-medium transition-all duration-300"
                  onClick={() => setIsOpen(false)}
                >
                  <SettingsIcon className="h-5 w-5" />
                  <span>إعدادات المستخدم</span>
                </Link>
              </>
            )}
            <Link
              to="/monthly-salary-report"
              className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 block px-4 py-3 rounded-lg text-base font-medium transition-all duration-300"
              onClick={() => setIsOpen(false)}
            >
              <DollarSignIcon className="h-5 w-5" />
              <span>تقرير المرتب الشهري</span>
            </Link>
            <Link
              to="/monthly-bonus-report"
              className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 block px-4 py-3 rounded-lg text-base font-medium transition-all duration-300"
              onClick={() => setIsOpen(false)}
            >
              <GiftIcon className="h-5 w-5" />
              <span>تقرير الحافز الشهري</span>
            </Link>
            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-white bg-red-500 hover:bg-red-600 block px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 w-full text-right"
              >
                <LogOutIcon className="h-5 w-5" />
                <span>تسجيل الخروج</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center space-x-2 text-gray-800 hover:text-blue-600 hover:bg-gray-100 block px-4 py-3 rounded-lg text-base font-medium transition-all duration-300"
                onClick={() => setIsOpen(false)}
              >
                <span>تسجيل الدخول</span>
              </Link>
            )}
          </div>
        </motion.div>
      )}
    </nav>
  );
};

export default Navbar;
