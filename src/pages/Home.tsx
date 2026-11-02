import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/Button';
import {
  BookOpen,
  PenTool,
  FileText,
  Target,
  BarChart3,
  Play,
  CheckCircle,
  TrendingUp,
  Users,
  Shield,
  Zap,
  Award,
  Sparkles,
  ArrowRight,
  Brain,
  BookMarked,
  Lightbulb,
  Layers,
  Clock,
} from 'lucide-react';
import { cn } from '../lib/utils';

const features = [
  {
    icon: PenTool,
    title: '个性化练习',
    description: '根据学习进度与薄弱环节智能推荐题目，练习更高效',
    accent: 'amber',
    href: '/practice',
    stats: '10K+ 题目',
    features: ['个性化推荐', '难度分级', '实时反馈'],
  },
  {
    icon: FileText,
    title: '模拟考试',
    description: '真实考试环境模拟，支持多种题型与自动评分',
    accent: 'emerald',
    href: '/exam',
    stats: '50+ 试卷',
    features: ['真实模拟', '自动评分', '详细分析'],
  },
  {
    icon: Target,
    title: '错题管理',
    description: '自动整理错误题目，提供针对性复习建议',
    accent: 'rose',
    href: '/wrongbook',
    stats: '自动整理',
    features: ['自动归类', '复习提醒', '针对性训练'],
  },
  {
    icon: BarChart3,
    title: '学习分析',
    description: '学习数据可视化，追踪进度，发现知识盲点',
    accent: 'violet',
    href: '/record',
    stats: '实时更新',
    features: ['数据可视化', '进度追踪', '学习报告'],
  },
];

const advantages = [
  {
    icon: Brain,
    title: '智能学习推荐',
    description: '根据学习进度和薄弱环节，为用户提供个性化的学习路径和题目推荐',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
  },
  {
    icon: Shield,
    title: '数据安全保障',
    description: '采用标准安全措施，确保用户数据隐私和学习记录的安全存储',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  {
    icon: Users,
    title: '多角色支持',
    description: '支持学生、教师、管理员三种角色，满足不同用户的需求',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
  },
  {
    icon: BookMarked,
    title: '丰富题库',
    description: '涵盖多个学科领域，题目类型多样化，内容定期更新',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
  },
  {
    icon: Zap,
    title: '流畅用户体验',
    description: '优化的系统架构，确保流畅的学习体验',
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
  },
  {
    icon: Award,
    title: '专业学习平台',
    description: '专注于提供高质量的学习资源和服务，值得信赖',
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/30',
  },
];

const testimonials = [
  {
    name: '林虎',
    role: '大一学生',
    content:
      '使用思政复习题库后，我的高数成绩有了明显提升！个性化推荐功能很精准，每次练习都很有针对性。',
    avatar: '🎓',
    rating: 5,
  },
  {
    name: '李老师',
    role: '思政教师',
    content:
      '这个系统减轻了我的工作负担，自动批改和数据分析功能让我能更好地了解学生的学习情况。',
    avatar: '👨‍🏫',
    rating: 5,
  },
  {
    name: '王同学',
    role: '大二学生',
    content:
      '错题本功能特别实用，帮助我很好地复习和巩固知识点。界面设计也很现代化，使用体验很棒！',
    avatar: '👩‍🎓',
    rating: 5,
  },
];

const accentMap: Record<string, { bg: string; border: string; iconBg: string; checkBg: string; checkIcon: string; statBg: string }> = {
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'hover:border-amber-300 dark:hover:border-amber-700',
    iconBg: 'from-amber-500 to-orange-500',
    checkBg: 'bg-amber-100 dark:bg-amber-900/30',
    checkIcon: 'text-amber-600 dark:text-amber-400',
    statBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
    iconBg: 'from-emerald-500 to-teal-500',
    checkBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    checkIcon: 'text-emerald-600 dark:text-emerald-400',
    statBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    border: 'hover:border-rose-300 dark:hover:border-rose-700',
    iconBg: 'from-rose-500 to-pink-500',
    checkBg: 'bg-rose-100 dark:bg-rose-900/30',
    checkIcon: 'text-rose-600 dark:text-rose-400',
    statBg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-950/20',
    border: 'hover:border-violet-300 dark:hover:border-violet-700',
    iconBg: 'from-violet-500 to-purple-500',
    checkBg: 'bg-violet-100 dark:bg-violet-900/30',
    checkIcon: 'text-violet-600 dark:text-violet-400',
    statBg: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
};

function HeroSection({ isAuthenticated, navigate }: { isAuthenticated: boolean; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background: light warm gradient, dark slate */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-stone-50 dark:from-slate-950 dark:via-slate-900 dark:to-stone-950" />

      {/* SVG grid texture */}
      <div
        className="absolute inset-0 dark:opacity-[0.03] opacity-[0.04]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      />

      {/* Decorative orbs: amber warm on light, amber/emerald on dark */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-300/15 dark:bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-300/10 dark:bg-emerald-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 container-responsive text-center py-20">
        <div className="max-w-4xl mx-auto">
          {/* Brand Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100/80 border border-amber-200 backdrop-blur-sm dark:bg-white/5 dark:border-white/10 dark:backdrop-blur-sm mb-8">
            <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <span className="text-sm text-amber-800 tracking-wide dark:text-slate-300">智能学习 · 高效提升</span>
          </div>

          {/* Main Heading */}
          <h1
            className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold text-secondary-900 dark:text-white leading-tight mb-8"
          >
            <span className="block">思政复习题库</span>
            <span className="block text-2xl md:text-3xl lg:text-4xl font-normal text-secondary-500 dark:text-slate-400 mt-3 font-sans">
              个性化学习平台
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-secondary-500 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            基于智能技术，为学习者提供个性化的学习体验，帮助用户更高效地掌握知识、提升成绩。
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 w-full">
            {!isAuthenticated ? (
              <>
                <Button
                  className="w-full sm:w-auto bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/25 transition-all duration-300 px-8"
                  icon={<Play className="h-5 w-5" />}
                  iconPosition="left"
                  size="xl"
                  onClick={() => navigate('/register')}
                >
                  开始学习
                </Button>
                <Button
                  className="w-full sm:w-auto border-secondary-300 text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900 hover:border-secondary-400 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-slate-500 transition-all duration-300 px-8"
                  icon={<Users className="h-5 w-5" />}
                  iconPosition="left"
                  size="xl"
                  variant="outline"
                  onClick={() => navigate('/login')}
                >
                  登录账户
                </Button>
              </>
            ) : (
              <Button
                className="w-full sm:w-auto bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/25 transition-all duration-300 px-8"
                icon={<Play className="h-5 w-5" />}
                iconPosition="left"
                size="xl"
                onClick={() => navigate('/practice')}
              >
                继续学习
              </Button>
            )}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 max-w-3xl mx-auto">
            {[
              { label: '注册学员', value: '10,000+', icon: Users },
              { label: '题目总数', value: '50,000+', icon: BookOpen },
              { label: '考试完成', value: '100,000+', icon: CheckCircle },
              { label: '活跃用户', value: '5,000+', icon: TrendingUp },
            ].map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div className="text-center" key={index}>
                  <div className="flex items-center justify-center mb-2">
                    <Icon className="h-5 w-5 text-amber-500/70 dark:text-amber-400/70" />
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-secondary-900 dark:text-white mb-0.5">
                    {stat.value}
                  </div>
                  <div className="text-xs text-secondary-400 dark:text-slate-500">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Fade: light and dark */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-secondary-50 dark:from-secondary-950 to-transparent" />
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="py-20 lg:py-28 bg-secondary-50 dark:bg-secondary-950">
      <div className="container-responsive">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium mb-4">
            <Layers className="h-4 w-4" />
            核心功能
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-900 dark:text-secondary-100 mb-4">
            全面的学习解决方案
          </h2>
          <p className="text-lg text-secondary-500 dark:text-secondary-400 max-w-2xl mx-auto">
            覆盖练习、考试、错题、分析全流程，为用户提供个性化的学习体验
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const style = accentMap[feature.accent];
            return (
              <Link
                className={cn(
                  'group block p-6 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800 transition-all duration-300 hover:shadow-lg cursor-pointer',
                  style.border,
                )}
                key={index}
                to={feature.href}
              >
                <div className={cn(
                  'inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br rounded-xl mb-5 shadow-sm',
                  style.iconBg,
                )}>
                  <Icon className="h-6 w-6 text-white" />
                </div>

                <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 mb-2">
                  {feature.title}
                </h3>

                <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-5 leading-relaxed">
                  {feature.description}
                </p>

                <div className="space-y-3">
                  <div className={cn('inline-flex items-center text-xs font-medium px-2 py-1 rounded-md', style.statBg)}>
                    {feature.stats}
                  </div>

                  <div className="space-y-2">
                    {feature.features.map((item, idx) => (
                      <div className="flex items-center text-sm text-secondary-600 dark:text-secondary-400" key={idx}>
                        <CheckCircle className={cn('h-3.5 w-3.5 mr-2 flex-shrink-0', style.checkIcon)} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex items-center text-sm font-medium text-secondary-400 group-hover:text-secondary-600 dark:group-hover:text-secondary-300 transition-colors">
                  进入学习
                  <ArrowRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AdvantagesSection() {
  return (
    <section className="py-20 lg:py-28 bg-white dark:bg-secondary-900">
      <div className="container-responsive">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium mb-4">
            <Lightbulb className="h-4 w-4" />
            平台特点
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-900 dark:text-secondary-100 mb-4">
            为什么选择我们
          </h2>
          <p className="text-lg text-secondary-500 dark:text-secondary-400 max-w-2xl mx-auto">
            我们专注于提供实用、高效、安全的学习平台
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {advantages.map((advantage, index) => {
            const Icon = advantage.icon;
            return (
              <div
                className="group p-6 rounded-2xl transition-all duration-300 hover:bg-secondary-50 dark:hover:bg-secondary-800/50"
                key={index}
              >
                <div className={cn(
                  'inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 transition-transform group-hover:scale-110',
                  advantage.color,
                  advantage.bg,
                )}>
                  <Icon className="h-6 w-6" />
                </div>

                <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 mb-2">
                  {advantage.title}
                </h3>

                <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                  {advantage.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-20 lg:py-28 bg-secondary-50 dark:bg-secondary-950">
      <div className="container-responsive">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm font-medium mb-4">
            <Award className="h-4 w-4" />
            用户评价
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-900 dark:text-secondary-100 mb-4">
            听听用户怎么说
          </h2>
          <p className="text-lg text-secondary-500 dark:text-secondary-400 max-w-2xl mx-auto">
            真实的反馈，见证成长与进步
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              className="bg-white dark:bg-secondary-900 rounded-2xl p-6 border border-secondary-200 dark:border-secondary-800 shadow-sm hover:shadow-md transition-shadow duration-300"
              key={index}
            >
              {/* Stars */}
              <div className="flex items-center gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <svg className="h-4 w-4 text-amber-400 fill-current" key={i} viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <p className="text-sm text-secondary-700 dark:text-secondary-300 leading-relaxed mb-6">
                {testimonial.content}
              </p>

              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/40 rounded-full flex items-center justify-center text-lg">
                  {testimonial.avatar}
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-semibold text-secondary-900 dark:text-secondary-100">
                    {testimonial.name}
                  </h4>
                  <p className="text-xs text-secondary-500 dark:text-secondary-400">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection({ isAuthenticated, navigate }: { isAuthenticated: boolean; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <section className="relative py-20 lg:py-28 overflow-hidden">
      {/* Background: light warm gradient, dark slate */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-stone-50 dark:from-slate-950 dark:via-slate-900 dark:to-stone-950" />

      {/* SVG grid texture */}
      <div
        className="absolute inset-0 dark:opacity-[0.03] opacity-[0.04]"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      />

      {/* Decorative orbs */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-amber-300/15 dark:bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-300/10 dark:bg-emerald-500/8 rounded-full blur-3xl" />

      <div className="container-responsive relative z-10 text-center">
        <div className="max-w-3xl mx-auto">
          <Clock className="h-10 w-10 text-amber-500 dark:text-amber-400 mx-auto mb-6" />
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-secondary-900 dark:text-white mb-4">
            准备好开始学习了吗？
          </h2>
          <p className="text-lg text-secondary-500 dark:text-slate-400 mb-10 max-w-xl mx-auto">
            加入思政复习题库系统，开启高效学习之旅
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mx-auto">
            {!isAuthenticated ? (
              <>
                <Button
                  className="w-full sm:w-auto bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/25 transition-all duration-300 px-8"
                  icon={<Play className="h-5 w-5" />}
                  iconPosition="left"
                  size="xl"
                  onClick={() => navigate('/register')}
                >
                  免费注册
                </Button>
                <Button
                  className="w-full sm:w-auto border-secondary-300 text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900 hover:border-secondary-400 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-slate-500 transition-all duration-300 px-8"
                  icon={<Users className="h-5 w-5" />}
                  iconPosition="left"
                  size="xl"
                  variant="outline"
                  onClick={() => navigate('/login')}
                >
                  登录账户
                </Button>
              </>
            ) : (
              <Button
                className="w-full sm:w-auto bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/25 transition-all duration-300 px-8"
                icon={<Play className="h-5 w-5" />}
                iconPosition="left"
                size="xl"
                onClick={() => navigate('/practice')}
              >
                继续学习
              </Button>
            )}
          </div>

          <div className="mt-10 flex flex-wrap justify-center items-center gap-6 text-sm text-secondary-400 dark:text-slate-500">
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              <span>安全可靠</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4" />
              <span>快速响应</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              <span>智能学习</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-950">
      <HeroSection isAuthenticated={isAuthenticated} navigate={navigate} />
      <FeaturesSection />
      <AdvantagesSection />
      <TestimonialsSection />
      <CTASection isAuthenticated={isAuthenticated} navigate={navigate} />
    </div>
  );
}
