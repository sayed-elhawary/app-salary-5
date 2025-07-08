import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import AuthProvider, { AuthContext } from './components/AuthProvider';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateAccount from './pages/CreateAccount';
import UploadFingerprint from './pages/UploadFingerprint';
import Reports from './pages/Reports';
import MonthlySalaryReport from './pages/MonthlySalaryReport';
import MonthlyBonusReport from './pages/MonthlyBonusReport';
import UserSettings from './pages/UserSettings';

const PrivateRoute = ({ children, role }) => {
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
    console.log('PrivateRoute: No user, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    console.log(`PrivateRoute: User role ${user.role} does not match required role ${role}, redirecting to /dashboard`);
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const RedirectBasedOnAuth = () => {
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
    console.log('RedirectBasedOnAuth: No user, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  console.log('RedirectBasedOnAuth: User exists, redirecting to /dashboard');
  return <Navigate to="/dashboard" replace />;
};

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">404 - الصفحة غير موجودة</h1>
        <p className="text-gray-600 mb-6">الصفحة التي تبحث عنها غير موجودة.</p>
        <Link
          to="/dashboard"
          className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300"
        >
          العودة إلى الداشبورد
        </Link>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/create-account"
            element={
              <PrivateRoute role="admin">
                <CreateAccount />
              </PrivateRoute>
            }
          />
          <Route
            path="/upload-fingerprint"
            element={
              <PrivateRoute role="admin">
                <UploadFingerprint />
              </PrivateRoute>
            }
          />
          <Route
            path="/users/settings"
            element={
              <PrivateRoute role="admin">
                <UserSettings />
              </PrivateRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <PrivateRoute role="admin">
                <Reports />
              </PrivateRoute>
            }
          />
          <Route
            path="/monthly-salary-report"
            element={
              <PrivateRoute>
                <MonthlySalaryReport />
              </PrivateRoute>
            }
          />
          <Route
            path="/monthly-bonus-report"
            element={
              <PrivateRoute>
                <MonthlyBonusReport />
              </PrivateRoute>
            }
          />
          <Route path="/" element={<RedirectBasedOnAuth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
