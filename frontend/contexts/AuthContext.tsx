'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { authService } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (userData: User) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Utilidades de Cookie compartida entre subdominios (*.brunoremises.com.ar)
function setCrossSubdomainCookie(name: string, value: string, days = 7) {
  if (typeof document === 'undefined') return;
  const hostname = window.location.hostname.toLowerCase();
  let domainPart = '';
  if (hostname.includes('brunoremises.com.ar')) {
    domainPart = '; domain=.brunoremises.com.ar';
  }
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = '; expires=' + date.toUTCString();
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}${expires}${domainPart}; path=/; SameSite=Lax${secure}`;
}

function getCrossSubdomainCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

function removeCrossSubdomainCookie(name: string) {
  if (typeof document === 'undefined') return;
  const hostname = window.location.hostname.toLowerCase();
  let domainPart = '';
  if (hostname.includes('brunoremises.com.ar')) {
    domainPart = '; domain=.brunoremises.com.ar';
  }
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC${domainPart}; path=/; SameSite=Lax`;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateStoredSession = async () => {
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      let savedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
      let accessToken = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
      let refreshToken = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken');

      // Si no hay sesión en este subdominio, sincronizar desde la cookie compartida de *.brunoremises.com.ar
      if (!savedUser || !accessToken) {
        const cookieUser = getCrossSubdomainCookie('bruno_user');
        const cookieToken = getCrossSubdomainCookie('bruno_access_token');
        const cookieRefresh = getCrossSubdomainCookie('bruno_refresh_token');
        if (cookieUser && cookieToken) {
          savedUser = cookieUser;
          accessToken = cookieToken;
          refreshToken = cookieRefresh;
        }
      }

      if (savedUser && accessToken) {
        try {
          const userData = JSON.parse(savedUser);
          if (userData && userData.id && userData.email && userData.rol) {
            const validRoles = ['ADMIN', 'DUENIO', 'COORDINADOR', 'CLIENTE', 'CHOFER'];
            if (validRoles.includes(userData.rol)) {
              setUser(userData);
              // Asegurar que la pestaña actual conserve su propia sesión en sessionStorage
              sessionStorage.setItem('user', savedUser);
              sessionStorage.setItem('accessToken', accessToken);
              if (refreshToken) {
                sessionStorage.setItem('refreshToken', refreshToken);
              }
            } else {
              throw new Error('Invalid user role');
            }
          } else {
            throw new Error('Invalid user data structure');
          }
        } catch (error) {
          console.error('Error parsing saved user:', error);
          sessionStorage.removeItem('user');
          sessionStorage.removeItem('accessToken');
          sessionStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }

      setLoading(false);
    };

    validateStoredSession();
  }, []);

  const login = (userData: User, accessToken: string, refreshToken: string) => {
    if (!userData || !userData.id || !userData.email || !userData.rol) {
      throw new Error('Invalid user data provided');
    }
    
    setUser(userData);
    const serialized = JSON.stringify(userData);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('user', serialized);
      sessionStorage.setItem('accessToken', accessToken);
      sessionStorage.setItem('refreshToken', refreshToken);
    }
    localStorage.setItem('user', serialized);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);

    // Guardar en cookie compartida para SSO entre subdominios
    setCrossSubdomainCookie('bruno_user', serialized);
    setCrossSubdomainCookie('bruno_access_token', accessToken);
    if (refreshToken) setCrossSubdomainCookie('bruno_refresh_token', refreshToken);
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
    }
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    // Limpiar cookie compartida de subdominios
    removeCrossSubdomainCookie('bruno_user');
    removeCrossSubdomainCookie('bruno_access_token');
    removeCrossSubdomainCookie('bruno_refresh_token');
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    const serialized = JSON.stringify(userData);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('user', serialized);
    }
    localStorage.setItem('user', serialized);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
