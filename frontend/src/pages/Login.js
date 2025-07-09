import React, { useState, useContext } from 'react';
import { AuthContext } from '../components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';

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

const Login = () => {
  const { login } = useContext(AuthContext);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(code, password); // إعادة التوجيه تحدث في AuthProvider
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setCode('');
        setPassword('');
      }, 2000);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 font-amiri">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white p-6 rounded-xl shadow-sm border border-gray-200"
      >
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6 text-right">
          تسجيل الدخول
        </h2>
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-right text-sm font-medium"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="space-y-6">
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              كود الموظف
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
              required
              disabled={loading}
            />
          </div>
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            className={`w-full bg-teal-500 text-white px-5 py-2.5 rounded-md hover:bg-teal-600 transition-all duration-200 text-sm font-medium shadow-sm ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'جاري الدخول...' : 'دخول'}
          </motion.button>
        </div>
        <AnimatePresence>
          {showSuccess && <SuccessCheckmark onComplete={() => setShowSuccess(false)} />}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Login;
