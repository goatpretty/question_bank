import { Navigate, RouteObject } from 'react-router-dom';
import { lazy } from 'react';
import Layout from '../components/Layout';
import { ProtectedRoute } from './ProtectedRoute';
import { TeacherRoute } from './TeacherRoute';
import { AdminRoute } from './AdminRoute';

// Lazy load page components
const Home = lazy(() => import('../pages/Home'));
const Practice = lazy(() => import('../pages/Practice'));
const Exams = lazy(() => import('../pages/Exams'));
const WrongBook = lazy(() => import('../pages/WrongBook'));
const Record = lazy(() => import('../pages/Record'));
const Settings = lazy(() => import('../pages/Settings'));
const QuestionManagement = lazy(() => import('../pages/admin/QuestionManagement'));
const ExamManagement = lazy(() => import('../pages/admin/ExamManagement'));
const AdminSettings = lazy(() => import('../pages/admin/AdminSettings'));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers'));

export const protectedRoutes: RouteObject[] = [
  {
    path: '/',
    element: <Layout><Home /></Layout>,
  },
  {
    path: '/practice',
    element: (
      <ProtectedRoute>
        <Layout><Practice /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/exam',
    element: (
      <ProtectedRoute>
        <Layout><Exams /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/wrongbook',
    element: (
      <ProtectedRoute>
        <Layout><WrongBook /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/record',
    element: (
      <ProtectedRoute>
        <Layout><Record /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    // 原个人资料页已合并到个人设置，保留旧地址跳转。
    path: '/profile',
    element: <Navigate to="/settings" replace />,
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <Layout><Settings /></Layout>
      </ProtectedRoute>
    ),
  },
  // Teacher routes
  {
    path: '/admin/question',
    element: (
      <TeacherRoute>
        <Layout><QuestionManagement /></Layout>
      </TeacherRoute>
    ),
  },
  {
    path: '/admin/exam',
    element: (
      <TeacherRoute>
        <Layout><ExamManagement /></Layout>
      </TeacherRoute>
    ),
  },
  // Admin routes
  {
    path: '/admin/settings',
    element: (
      <AdminRoute>
        <Layout><AdminSettings /></Layout>
      </AdminRoute>
    ),
  },
  {
    path: '/admin/users',
    element: (
      <AdminRoute>
        <Layout><AdminUsers /></Layout>
      </AdminRoute>
    ),
  },
];
