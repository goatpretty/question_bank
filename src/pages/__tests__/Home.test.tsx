import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Home from '../Home';
import { questionService } from '../../services/questionService';
import { metaService } from '../../services/metaService';

let mockAuthState = { user: null, isAuthenticated: false };

jest.mock('../../stores/auth', () => ({
  useAuthStore: () => mockAuthState,
}));

jest.mock('../../services/questionService', () => ({
  questionService: { getPublicStats: jest.fn() },
}));

jest.mock('../../services/metaService', () => ({
  metaService: { getMeta: jest.fn() },
}));

const getPublicStats = questionService.getPublicStats as jest.Mock;
const getMeta = metaService.getMeta as jest.Mock;

const statsResponse = {
  success: true,
  data: {
    totals: {
      topics: 49,
      courses: 49,
      chapters: 0,
      questions: 1514,
      options: 6052,
    },
  },
};

const metaResponse = {
  success: true,
  data: {
    name: 'question-bank',
    version: '0.1.0',
    registrationEnabled: true,
    aiEnabled: false,
    database: 'SQLite',
    license: 'MIT',
    dataLicense: 'CC BY 4.0',
    repository: 'https://github.com/goatpretty/question_bank',
  },
};

const renderHome = async () => {
  const result = render(
    <BrowserRouter>
      <Home />
    </BrowserRouter>
  );
  // 等待统计接口返回，确保 effect 内的状态更新完成
  await screen.findByText('1,514');
  return result;
};

describe('Home Page', () => {
  beforeEach(() => {
    mockAuthState = { user: null, isAuthenticated: false };
    getPublicStats.mockReset().mockResolvedValue(statsResponse);
    getMeta.mockReset().mockResolvedValue(metaResponse);
  });

  it('renders the open-source hero section', async () => {
    await renderHome();

    expect(screen.getByText('思政复习题库')).toBeInTheDocument();
    expect(screen.getByText('开源题库练习与自测系统')).toBeInTheDocument();
    expect(screen.getByText('开源 · 自托管 · SQLite')).toBeInTheDocument();
  });

  it('renders real totals from the stats API', async () => {
    await renderHome();

    expect(screen.getByText('49')).toBeInTheDocument();
    expect(screen.getByText('1,514')).toBeInTheDocument();
    expect(screen.getByText('6,052')).toBeInTheDocument();
    expect(screen.getByText('统计数据来自当前部署的数据库')).toBeInTheDocument();
  });

  it('shows register entry only when registration is enabled', async () => {
    await renderHome();

    expect(screen.getByText('登录系统')).toBeInTheDocument();
    expect(screen.getByText('注册账号')).toBeInTheDocument();
    expect(screen.queryByText('当前部署未启用自助注册，账号由管理员创建。')).not.toBeInTheDocument();
  });

  it('hides register entry when SMTP is not configured', async () => {
    getMeta.mockResolvedValue({
      ...metaResponse,
      data: { ...metaResponse.data, registrationEnabled: false },
    });

    render(
      <BrowserRouter>
        <Home />
      </BrowserRouter>
    );

    expect(
      await screen.findByText('当前部署未启用自助注册，账号由管理员创建。')
    ).toBeInTheDocument();
    expect(screen.queryByText('注册账号')).not.toBeInTheDocument();
    expect(screen.getByText('登录系统')).toBeInTheDocument();
  });

  it('links to the GitHub repository', async () => {
    await renderHome();

    expect(screen.getByRole('link', { name: 'GitHub 源码' })).toHaveAttribute(
      'href',
      'https://github.com/goatpretty/question_bank'
    );
    expect(screen.getByText('版本记录')).toBeInTheDocument();
  });

  it('renders only implemented features', async () => {
    await renderHome();

    expect(screen.getByText('专题练习')).toBeInTheDocument();
    expect(screen.getByText('模拟考试')).toBeInTheDocument();
    expect(screen.getByText('错题本')).toBeInTheDocument();
    expect(screen.getByText('学习记录')).toBeInTheDocument();
    expect(screen.getByText('自托管部署')).toBeInTheDocument();
  });

  it('does not render fabricated marketing claims', async () => {
    await renderHome();

    expect(screen.queryByText('10,000+')).not.toBeInTheDocument();
    expect(screen.queryByText('50,000+')).not.toBeInTheDocument();
    expect(screen.queryByText('100,000+')).not.toBeInTheDocument();
    expect(screen.queryByText('智能学习推荐')).not.toBeInTheDocument();
    expect(screen.queryByText(/高数成绩/)).not.toBeInTheDocument();
    expect(screen.queryByText('免费注册')).not.toBeInTheDocument();
  });

  it('shows practice entry for authenticated users', async () => {
    mockAuthState = { user: { id: 'u1', username: 'demo', role: 'student' } as never, isAuthenticated: true };

    await renderHome();

    expect(screen.getByText('继续练习')).toBeInTheDocument();
    expect(screen.getByText('考试中心')).toBeInTheDocument();
    expect(screen.queryByText('登录系统')).not.toBeInTheDocument();
  });
});
