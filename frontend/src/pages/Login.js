import React, { useState, useContext } from 'react';
import { AuthContext } from '../components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 px-4">
      <div className="max-w-md md:max-w-lg w-full bg-white rounded-xl shadow-xl p-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center text-gray-800">تسجيل الدخول</h2>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-500 text-center mb-4 text-sm md:text-base"
          >
            {error}
          </motion.div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 mb-2 text-sm md:text-base">كود الموظف</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg min-w-[200px]"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2 text-sm md:text-base">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg min-w-[200px]"
              required
            />
          </div>
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors duration-300 text-sm md:text-base ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'جاري الدخول...' : 'دخول'}
          </motion.button>
        </form>
        <AnimatePresence>
          {showSuccess && <SuccessCheckmark onComplete={() => setShowSuccess(false)} />}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Login;
