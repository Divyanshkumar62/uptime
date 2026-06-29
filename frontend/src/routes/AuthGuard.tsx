import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const adminApiKey = useAuthStore((state) => state.adminApiKey);
  const location = useLocation();

  if (!adminApiKey) {
    // Redirect to login page and store source path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
