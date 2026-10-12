import React, { createContext, useContext, useState } from 'react';
import { fetchApi, checkServerHealth } from '../config/api.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('vigil_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (email, password, portalRole = null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi('/api/auth/login', {
        method: 'POST',
        body: { email, password, portal_role: portalRole }
      });

      setUser(data);
      localStorage.setItem('vigil_user', JSON.stringify(data));
      setLoading(false);
      return data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  const registerStudent = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi('/api/auth/student/register', {
        method: 'POST',
        body: formData
      });

      setUser(data);
      localStorage.setItem('vigil_user', JSON.stringify(data));
      setLoading(false);
      return data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  const registerProctor = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi('/api/auth/proctor/register', {
        method: 'POST',
        body: formData
      });

      setUser(data);
      localStorage.setItem('vigil_user', JSON.stringify(data));
      setLoading(false);
      return data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  const registerAdmin = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi('/api/auth/admin/register', {
        method: 'POST',
        body: formData
      });

      setUser(data);
      localStorage.setItem('vigil_user', JSON.stringify(data));
      setLoading(false);
      return data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('vigil_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        registerStudent,
        registerProctor,
        registerAdmin,
        logout,
        loading,
        error,
        checkServerHealth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
