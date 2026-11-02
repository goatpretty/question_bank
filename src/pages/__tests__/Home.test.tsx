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
    
    expect(screen.getByText('思政复习题库')).toBeInTheDocument();
    expect(screen.getByText('个性化学习平台')).toBeInTheDocument();
  });

  it('renders call to action buttons for non-authenticated users', () => {
    renderWithRouter(<Home />);
    
    expect(screen.getByText('开始学习')).toBeInTheDocument();
    expect(screen.getAllByText('登录账户').length).toBeGreaterThan(0);
  });

  it('renders features section', () => {
    renderWithRouter(<Home />);
    
    expect(screen.getByText('核心功能')).toBeInTheDocument();
    expect(screen.getByText('个性化练习')).toBeInTheDocument();
    expect(screen.getByText('模拟考试')).toBeInTheDocument();
    expect(screen.getByText('错题管理')).toBeInTheDocument();
    expect(screen.getByText('学习分析')).toBeInTheDocument();
  });

  it('renders advantages section', () => {
    renderWithRouter(<Home />);
    
    expect(screen.getByText('平台特点')).toBeInTheDocument();
    expect(screen.getByText('多角色支持')).toBeInTheDocument();
    expect(screen.getByText('丰富题库')).toBeInTheDocument();
    expect(screen.getByText('智能学习推荐')).toBeInTheDocument();
  });

  it('renders final call to action', () => {
    renderWithRouter(<Home />);
    
    expect(screen.getByText('准备好开始学习了吗？')).toBeInTheDocument();
    expect(screen.getByText('免费注册')).toBeInTheDocument();
  });
});