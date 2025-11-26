import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useTheme } from '../hooks/useTheme';
import { Button, IconButton } from './ui/Button';
import { 
  BookOpen, 
  Home, 
  PenTool, 
  FileText, 
  Target, 
  BarChart3,
  Settings,
  LogOut,
  User,
  Users,
  BarChart3 as ChartIcon,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  Bell,
  Search
} from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ElementType;
  description?: string;
  badge?: string | number;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuthStore();
  const { theme, resolvedTheme, isDark, isLight, toggleTheme, setSystemTheme, setTheme, setLightTheme, setDarkTheme, systemTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsUserMenuOpen(false);
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const mainNavigation: NavigationItem[] = [
    { name: '首页', href: '/', icon: Home, description: '系统概览与快速入口' },
    { name: '练习中心', href: '/practice', icon: PenTool, description: '智能推荐个性化练习' },
    { name: '考试中心', href: '/exam', icon: FileText, description: '模拟考试与真实测评' },
    { name: '错题本', href: '/wrongbook', icon: Target, description: '针对性巩固薄弱环节' },
    { name: '学习记录', href: '/record', icon: BarChart3, description: '详细学习数据分析' },
  ];

  const teacherNavigation: NavigationItem[] = [
    { name: '题库管理', href: '/admin/question', icon: BookOpen, description: '题目录入与管理' },
    { name: '考试管理', href: '/admin/exam', icon: FileText, description: '考试创建与监控' },
  ];

  const adminNavigation: NavigationItem[] = [
    { name: '用户管理', href: '/admin/users', icon: Users, description: '查看用户与重置密码' },
    { name: '系统设置', href: '/admin/settings', icon: Settings, description: '系统配置与管理' },
  ];

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.user-menu-container')) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isUserMenuOpen]);

  const ThemeToggle = () => {
    const [isOpen, setIsOpen] = useState(false);
    
    const getThemeIcon = () => {
      if (theme === 'system') {
        return <Monitor className="h-5 w-5" />;
      }
      return isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />;
    };

    const getThemeLabel = () => {
      if (theme === 'system') return '系统';
      return isDark ? '浅色' : '深色';
    };

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Element;
        if (!target.closest('.theme-toggle-container')) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    return (
      <div className="relative theme-toggle-container">
        <IconButton
          icon={getThemeIcon()}
          variant="ghost"
          onClick={() => {
            if (theme === 'system') {
              // If system, toggle between light and dark based on current system theme
              setTheme(systemTheme === 'dark' ? 'light' : 'dark');
            } else {
              // If manual theme, cycle through: light -> dark -> system
              if (theme === 'light') {
                setTheme('dark');
              } else if (theme === 'dark') {
                setTheme('system');
              }
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setIsOpen(!isOpen);
          }}
          tooltip={`切换到${getThemeLabel()}模式 (右键查看更多选项)`}
        />
        
        {/* Theme Selector Dropdown */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-secondary-800 rounded-lg shadow-strong border border-secondary-200 dark:border-secondary-700 z-50 animate-scale-in">
            <div className="p-2">
              <button
                onClick={() => {
                  setSystemTheme();
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                  theme === 'system' 
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' 
                    : 'text-secondary-700 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-700'
                )}
              >
                <Monitor className="h-4 w-4 mr-3" />
                系统默认
              </button>
              <button
                onClick={() => {
                  setLightTheme();
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                  resolvedTheme === 'light' && theme !== 'system'
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' 
                    : 'text-secondary-700 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-700'
                )}
              >
                <Sun className="h-4 w-4 mr-3" />
                浅色模式
              </button>
              <button
                onClick={() => {
                  setDarkTheme();
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                  resolvedTheme === 'dark' && theme !== 'system'
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' 
                    : 'text-secondary-700 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-700'
                )}
              >
                <Moon className="h-4 w-4 mr-3" />
                深色模式
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const UserMenu = () => {
    if (!isAuthenticated || !user) return null;

    return (
      <div className="relative user-menu-container">
        <button
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-soft">
            <User className="h-5 w-5 text-white" />
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-secondary-900 dark:text-secondary-100">{user.username}</p>
            <p className="text-xs text-secondary-500 dark:text-secondary-400">
              {user.role === 'student' ? '学生' : user.role === 'teacher' ? '教师' : '管理员'}
            </p>
          </div>
          <ChevronDown className={cn(
            "h-4 w-4 text-secondary-400 transition-transform",
            isUserMenuOpen && "transform rotate-180"
          )} />
        </button>

        {isUserMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-secondary-800 rounded-lg shadow-strong border border-secondary-200 dark:border-secondary-700 z-50 animate-scale-in">
            <div className="p-2">
              <div className="px-3 py-2 text-sm text-secondary-600 dark:text-secondary-400 border-b border-secondary-200 dark:border-secondary-700">
                <p className="font-medium text-secondary-900 dark:text-secondary-100">{user.username}</p>
                <p className="text-xs">{user.email}</p>
              </div>
              
              <div className="py-2">
                <button
                  onClick={() => {
                    navigate('/profile');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-secondary-700 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-700 rounded-md transition-colors"
                >
                  <User className="h-4 w-4 mr-3" />
                  个人资料
                </button>
                
                <button
                  onClick={() => {
                    navigate('/settings');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-secondary-700 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-700 rounded-md transition-colors"
                >
                  <Settings className="h-4 w-4 mr-3" />
                  账户设置
                </button>
              </div>
              
              <div className="border-t border-secondary-200 dark:border-secondary-700 pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-3 py-2 text-sm text-error hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-3" />
                  退出登录
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const NavigationItem = ({ item, isActive }: { item: NavigationItem; isActive: boolean }) => {
    const Icon = item.icon;
    
    return (
      <Link
        to={item.href}
        className={cn(
          "group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 relative overflow-hidden",
          isActive
            ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-soft"
            : "text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-800/50"
        )}
      >
        {/* Active indicator */}
        {isActive && (
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-white rounded-r-full shadow-sm" />
        )}
        
        <Icon className={cn(
          "h-5 w-5 mr-4 transition-transform group-hover:scale-110",
          isActive && "text-white"
        )} />
        
        <div className="flex-1">
          <div className={cn(
            "font-medium",
            isActive ? "text-white" : ""
          )}>
            {item.name}
          </div>
          {item.description && (
            <div className={cn(
              "text-xs mt-0.5",
              isActive ? "text-primary-100" : "text-secondary-500 dark:text-secondary-500"
            )}>
              {item.description}
            </div>
          )}
        </div>
        
        {item.badge && (
          <div className={cn(
            "ml-2 px-2 py-0.5 text-xs rounded-full",
            isActive 
              ? "bg-white text-primary-600" 
              : "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
          )}>
            {item.badge}
          </div>
        )}
      </Link>
    );
  };

  const Sidebar = ({ isMobile = false }: { isMobile?: boolean }) => (
    <aside className={cn(
      "bg-white dark:bg-secondary-900 border-r border-secondary-200 dark:border-secondary-800",
      isMobile 
        ? "fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out"
        : "hidden lg:block w-80 flex-shrink-0"
    )}>
      <div className="h-full flex flex-col">
        {/* Logo Section */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-secondary-200 dark:border-secondary-800">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-soft">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                智能题库
              </h1>
              <p className="text-xs text-secondary-500 dark:text-secondary-400">Intelligent Question Bank</p>
            </div>
          </Link>
          
          {isMobile && (
            <IconButton
              icon={<X className="h-6 w-6" />}
              variant="ghost"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {mainNavigation.map((item) => (
            <NavigationItem 
              key={item.name} 
              item={item} 
              isActive={isActive(item.href)}
            />
          ))}

          {user?.role === 'teacher' && (
            <div className="pt-4 mt-4 border-t border-secondary-200 dark:border-secondary-800">
              <p className="px-4 text-xs font-semibold text-secondary-500 dark:text-secondary-400 uppercase tracking-wider mb-3">
                教师功能
              </p>
              {teacherNavigation.map((item) => (
                <NavigationItem 
                  key={item.name} 
                  item={item} 
                  isActive={isActive(item.href)}
                />
              ))}
            </div>
          )}

          {user?.role === 'admin' && (
            <div className="pt-4 mt-4 border-t border-secondary-200 dark:border-secondary-800">
              <p className="px-4 text-xs font-semibold text-secondary-500 dark:text-secondary-400 uppercase tracking-wider mb-3">
                管理员功能
              </p>
              {adminNavigation.map((item) => (
                <NavigationItem 
                  key={item.name} 
                  item={item} 
                  isActive={isActive(item.href)}
                />
              ))}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-secondary-200 dark:border-secondary-800">
          <div className="flex items-center justify-between">
            <ThemeToggle />
            {!isMobile && <UserMenu />}
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-950">
      

      {/* Header */}
      <header className="lg:hidden bg-white dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-800 sticky top-0 z-30">
        <div className="flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
              智能题库
            </span>
          </Link>

          <div className="flex items-center space-x-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <Sidebar />

        

        {/* Main Content */}
        <main className="flex-1 lg:ml-0">
          {/* Top Bar */}
          {isAuthenticated && (
            <div className="hidden lg:flex items-center justify-between h-20 px-8 bg-white dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-800">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100">
                  {mainNavigation.find(item => isActive(item.href))?.name || 
                   teacherNavigation.find(item => isActive(item.href))?.name ||
                   adminNavigation.find(item => isActive(item.href))?.name ||
                   '页面'}
                </h2>
              </div>
              
              <div className="flex items-center space-x-4">
                <IconButton
                  icon={<Search className="h-5 w-5" />}
                  variant="ghost"
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  tooltip="搜索"
                />
                <IconButton
                  icon={<Bell className="h-5 w-5" />}
                  variant="ghost"
                  tooltip="通知"
                />
                <UserMenu />
              </div>
            </div>
          )}

          {/* Search Bar */}
          {isSearchOpen && (
            <div className="hidden lg:block p-4 bg-white dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-800">
              <div className="max-w-2xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
                  <input
                    type="text"
                    placeholder="搜索题目、考试或学习记录..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input pl-10 pr-4"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Page Content */}
          <div className={cn(
            "mx-auto",
            isAuthenticated 
              ? "px-4 sm:px-6 lg:px-8 py-6 lg:py-8" 
              : "px-4 sm:px-6 lg:px-8 py-8 lg:py-12"
          )}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
