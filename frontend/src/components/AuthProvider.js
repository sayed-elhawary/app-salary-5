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

  const checkAuth = async (retries = 2, delay = 1000) => {
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
      if (retries > 0) {
        console.log(`Retrying /api/users/me, attempts left: ${retries}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return checkAuth(retries - 1, delay * 2);
      }
      console.error('Error verifying token:', {
        message: err.response?.data?.message || err.message,
        status: err.response?.status,
        url: `${process.env.REACT_APP_API_URL}/api/users/me`,
      });
      localStorage.removeItem('token');
      setUser(null);
      navigate('/login', { replace: true });
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
    console.log('Logging out, removing token');
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
