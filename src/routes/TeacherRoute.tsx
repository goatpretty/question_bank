import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

interface TeacherRouteProps {
  children: ReactNode;
}

export const TeacherRoute = ({ children }: TeacherRouteProps) => {
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: { pathname: location.pathname, search: location.search, hash: location.hash } }} />;
  if (user?.role !== 'teacher' && user?.role !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
};
