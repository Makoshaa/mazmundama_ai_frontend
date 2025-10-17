import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

const API_URL = 'http://127.0.0.1:8080';

interface AuthContextType {
  token: string | null;
  userId: number | null;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [userId, setUserId] = useState<number | null>(
    localStorage.getItem('user_id') ? parseInt(localStorage.getItem('user_id')!) : null
  );
  const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));

  const login = async (username: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка входа');
    }

    const data = await response.json();
    
    setToken(data.access_token);
    setUserId(data.user_id);
    setUsername(data.username);
    
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('user_id', data.user_id.toString());
    localStorage.setItem('username', data.username);
  };

  const register = async (username: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка регистрации');
    }

    const data = await response.json();
    
    setToken(data.access_token);
    setUserId(data.user_id);
    setUsername(data.username);
    
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('user_id', data.user_id.toString());
    localStorage.setItem('username', data.username);
  };

  const logout = () => {
    setToken(null);
    setUserId(null);
    setUsername(null);
    
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        userId,
        username,
        login,
        register,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
