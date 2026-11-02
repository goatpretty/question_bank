import { BrowserRouter as Router, useRoutes, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/auth';
import { allRoutes } from './routes';
import ForceChangePasswordModal from './components/ForceChangePasswordModal';

// Loading component for lazy loading
const Loading = () => (
  <div className="min-h-screen bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
        <div className="w-8 h-8 bg-white rounded-lg animate-pulse" />
      </div>
      <div className="text-white text-lg font-medium mb-2">思政复习题库系统</div>
      <div className="text-amber-100 text-sm">正在加载中...</div>
      
      {/* Loading animation */}
      <div className="mt-8 flex justify-center space-x-2">
        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0s'}} />
        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0.1s'}} />
        <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
      </div>
    </div>
  </div>
);

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [showForceChangePassword, setShowForceChangePassword] = useState(false);
  const { checkAuth, user } = useAuthStore();

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

  // 检查用户是否需要强制修改密码
  useEffect(() => {
    if (user?.needPasswordChange) {
      setShowForceChangePassword(true);
    } else {
      setShowForceChangePassword(false);
    }
  }, [user?.needPasswordChange]);

  // Loading state with industrial design
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <div className="w-8 h-8 bg-white rounded-lg animate-pulse" />
          </div>
          <div className="text-white text-lg font-medium mb-2">思政复习题库系统</div>
          <div className="text-amber-100 text-sm">正在加载中...</div>
          
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

  // Route rendering component
  const RoutesComponent = () => {
    // Combine all routes and add catch-all route
    const routes = [...allRoutes, {
      path: '*',
      element: <Navigate to="/" replace />
    }];
    return useRoutes(routes);
  };

  return (
    <Router>
      <div className="App">
        <Suspense fallback={<Loading />}>
          <RoutesComponent />
        </Suspense>
        {/* 强制修改密码对话框 */}
        <ForceChangePasswordModal
          isOpen={showForceChangePassword}
          onClose={() => setShowForceChangePassword(false)}
        />
      </div>
    </Router>
  );
}

export default App;
