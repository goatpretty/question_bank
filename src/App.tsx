import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/auth';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Practice from './pages/Practice';
import Exams from './pages/Exams';
import WrongBook from './pages/WrongBook';
import Record from './pages/Record';
import QuestionManagement from './pages/admin/QuestionManagement';
import ExamManagement from './pages/admin/ExamManagement';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import AdminSettings from './pages/admin/AdminSettings';
import AdminUsers from './pages/admin/AdminUsers';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function TeacherRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'teacher' && user?.role !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const { checkAuth } = useAuthStore();

  // Initialize theme and auth on app load
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Preload theme to prevent flash
        const preloadTheme = () => {
          if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            const finalTheme = savedTheme === 'system' ? systemTheme : (savedTheme || systemTheme);
            
            document.documentElement.classList.add(finalTheme);
            document.body.classList.add(`theme-${finalTheme}`);
            
            const metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (metaThemeColor) {
              metaThemeColor.setAttribute('content', finalTheme === 'dark' ? '#020617' : '#f8fafc');
            }
          }
        };
        
        // Call theme preload immediately
        preloadTheme();
        
        // Check authentication status
        await checkAuth();
        
        // Add smooth page transitions
        document.body.classList.add('animate-fade-in');
        
        // Set up performance monitoring
        if (typeof window !== 'undefined' && 'performance' in window) {
          // Monitor Core Web Vitals
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              console.log(`${entry.name}: ${entry.duration}ms`);
            }
          });
          observer.observe({ entryTypes: ['measure', 'navigation'] });
        }
        
        // Set up error boundary
        window.addEventListener('error', (e) => {
          console.error('Global error:', e.error);
        });
        
        window.addEventListener('unhandledrejection', (e) => {
          console.error('Unhandled promise rejection:', e.reason);
        });
        
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [checkAuth]);

  // Loading state with industrial design
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <div className="w-8 h-8 bg-white rounded-lg animate-pulse" />
          </div>
          <div className="text-white text-lg font-medium mb-2">智能题库系统</div>
          <div className="text-primary-100 text-sm">正在加载中...</div>
          
          {/* Loading animation */}
          <div className="mt-8 flex justify-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0s'}} />
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0.1s'}} />
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected routes with Layout */}
          <Route 
            path="/" 
            element={
              <Layout>
                <Home />
              </Layout>
            } 
          />
          
          <Route 
            path="/practice" 
            element={
              <ProtectedRoute>
                <Layout>
                  <Practice />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/exam" 
            element={
              <ProtectedRoute>
                <Layout>
                  <Exams />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/wrongbook" 
            element={
              <ProtectedRoute>
                <Layout>
                  <WrongBook />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/record" 
            element={
              <ProtectedRoute>
                <Layout>
                  <Record />
                </Layout>
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Layout>
                  <Profile />
                </Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            } 
          />
          
          {/* Admin/Teacher routes */}
          <Route 
            path="/admin/question" 
            element={
              <TeacherRoute>
                <Layout>
                  <QuestionManagement />
                </Layout>
              </TeacherRoute>
            } 
          />
          
          <Route 
            path="/admin/exam" 
            element={
              <TeacherRoute>
                <Layout>
                  <ExamManagement />
                </Layout>
              </TeacherRoute>
            } 
          />

          <Route 
            path="/admin/settings" 
            element={
              <AdminRoute>
                <Layout>
                  <AdminSettings />
                </Layout>
              </AdminRoute>
            } 
          />
          <Route 
            path="/admin/users" 
            element={
              <AdminRoute>
                <Layout>
                  <AdminUsers />
                </Layout>
              </AdminRoute>
            } 
          />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
