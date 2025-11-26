import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from '../Home';

// Mock the auth store
jest.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    user: null,
    isAuthenticated: false,
  }),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Home Page', () => {
  it('renders hero section', () => {
    renderWithRouter(<Home />);
    
    expect(screen.getByText('智能题库系统')).toBeInTheDocument();
    expect(screen.getByText('个性化学习体验，智能化题库管理')).toBeInTheDocument();
  });

  it('renders call to action buttons for non-authenticated users', () => {
    renderWithRouter(<Home />);
    
    expect(screen.getByText('立即开始')).toBeInTheDocument();
    expect(screen.getByText('登录账户')).toBeInTheDocument();
  });

  it('renders features section', () => {
    renderWithRouter(<Home />);
    
    expect(screen.getByText('核心功能')).toBeInTheDocument();
    expect(screen.getByText('智能练习')).toBeInTheDocument();
    expect(screen.getByText('模拟考试')).toBeInTheDocument();
    expect(screen.getByText('错题管理')).toBeInTheDocument();
    expect(screen.getByText('学习分析')).toBeInTheDocument();
  });

  it('renders advantages section', () => {
    renderWithRouter(<Home />);
    
    expect(screen.getByText('系统优势')).toBeInTheDocument();
    expect(screen.getByText('多角色支持')).toBeInTheDocument();
    expect(screen.getByText('丰富题库')).toBeInTheDocument();
    expect(screen.getByText('智能评分')).toBeInTheDocument();
  });

  it('renders final call to action', () => {
    renderWithRouter(<Home />);
    
    expect(screen.getByText('准备好开始学习了吗？')).toBeInTheDocument();
    expect(screen.getByText('免费注册')).toBeInTheDocument();
  });
});