import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  if (!process.env.REACT_APP_API_URL) {
    console.error('REACT_APP_API_URL is not defined in environment variables');
    throw new Error('REACT_APP_API_URL is required');
  }

  const checkAuth = async (retries = 2, delay = 500) => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token found in localStorage');
      setUser(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    try {
      console.log('Sending request to /api/users/me with token:', token.substring(0, 20) + '...');
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      console.log('User fetched successfully:', res.data.user);
      setUser(res.data.user);
    } catch (err) {
      if (err.code === 'ERR_CANCELED') {
        console.log('Request to /api/users/me was canceled');
        return;
      }
      console.error('Error verifying token:', {
        message: err.response?.data?.message || err.message,
        status: err.response?.status,
        url: `${process.env.REACT_APP_API_URL}/api/users/me`,
        responseData: err.response?.data,
      });

      // محاولة تجديد الرمز إذا كان الخطأ 401
      if (err.response?.status === 401 && retries > 0) {
        try {
          console.log('Attempting to refresh token');
          const refreshRes = await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/refresh`, { token });
          const newToken = refreshRes.data.token;
          localStorage.setItem('token', newToken);
          localStorage.setItem('tokenTimestamp', Date.now().toString());
          console.log('Token refreshed, retrying /api/users/me');
          return checkAuth(retries - 1, delay);
        } catch (refreshErr) {
          console.error('Token refresh failed:', refreshErr.response?.data?.message || refreshErr.message);
        }
      }

      // إذا كان الرمز جديدًا (أقل من 5 ثوانٍ)، تجنب إعادة التوجيه
      const tokenTimestamp = localStorage.getItem('tokenTimestamp');
      if (tokenTimestamp && Date.now() - parseInt(tokenTimestamp) < 5000) {
        console.log('Token is fresh, skipping redirect to /login');
        setUser(null);
        setLoading(false);
        return;
      }

      if (retries > 0) {
        console.log(`Retrying /api/users/me, attempts left: ${retries}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return checkAuth(retries - 1, delay * 2);
      }

      localStorage.removeItem('token');
      localStorage.removeItem('tokenTimestamp');
      setUser(null);
      navigate('/login', {
        replace: true,
        state: { error: err.response?.data?.message || 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى' },
      });
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  };

  useEffect(() => {
    checkAuth().catch((err) => console.error('CheckAuth failed:', err));
  }, [navigate]);

  const login = useCallback(
    async (code, password) => {
      try {
        console.log('Attempting login with code:', code);
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/login`, {
          code,
          password,
        });
        console.log('Login successful, user:', res.data.user);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('tokenTimestamp', Date.now().toString());
        setUser(res.data.user);
        setLoading(false);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('Login error:', {
          message: err.response?.data?.message || err.message,
          status: err.response?.status,
        });
        throw err;
      }
    },
    [navigate]
  );

  const logout = useCallback(() => {
    console.log('Logging out, removing token and timestamp');
    localStorage.removeItem('token');
    localStorage.removeItem('tokenTimestamp');
    setUser(null);
    navigate('/login', { replace: true, state: { error: 'تم تسجيل الخروج بنجاح' } });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
