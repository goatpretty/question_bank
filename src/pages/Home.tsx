import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth';
import { Button, IconButton } from '../components/ui/Button';
import { 
  BookOpen, 
  PenTool, 
  FileText, 
  Target, 
  BarChart3, 
  Users, 
  Play, 
  CheckCircle,
  TrendingUp,
  Award,
  Zap,
  Shield,
  Star,
  ArrowRight,
  Book,
  Clock,
  Target as TargetIcon,
  Brain,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Home() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const features = [
    {
      icon: PenTool,
      title: '智能练习',
      description: 'AI驱动的个性化题目推荐，根据学习进度和薄弱环节智能调整练习内容',
      color: 'from-blue-500 to-cyan-500',
      href: '/practice',
      stats: '10K+ 题目',
      features: ['智能推荐', '难度自适应', '实时反馈']
    },
    {
      icon: FileText,
      title: '模拟考试',
      description: '真实考试环境模拟，支持多种题型，提供详细的成绩分析和改进建议',
      color: 'from-green-500 to-emerald-500',
      href: '/exam',
      stats: '50+ 试卷',
      features: ['真实模拟', '智能评分', '详细分析']
    },
    {
      icon: Target,
      title: '错题管理',
      description: '智能错题本自动整理错误题目，提供针对性复习建议和巩固练习',
      color: 'from-red-500 to-rose-500',
      href: '/wrongbook',
      stats: '智能整理',
      features: ['自动归类', '复习提醒', '针对性训练']
    },
    {
      icon: BarChart3,
      title: '学习分析',
      description: '全面的学习数据可视化，追踪学习进度，发现知识盲点',
      color: 'from-purple-500 to-violet-500',
      href: '/record',
      stats: '实时更新',
      features: ['数据可视化', '进度追踪', '智能报告']
    }
  ];

  const advantages = [
    {
      icon: Brain,
      title: 'AI智能引擎',
      description: '采用先进的机器学习算法，为每位用户提供个性化的学习路径和题目推荐',
      gradient: 'from-blue-500 to-purple-500'
    },
    {
      icon: Shield,
      title: '数据安全保障',
      description: '采用企业级安全标准，确保用户数据隐私和学习记录的安全存储',
      gradient: 'from-green-500 to-teal-500'
    },
    {
      icon: Users,
      title: '多角色支持',
      description: '学生、教师、管理员三种角色，满足不同用户群体的专业需求',
      gradient: 'from-orange-500 to-red-500'
    },
    {
      icon: Book,
      title: '丰富题库',
      description: '涵盖多个学科领域，题目类型多样化，内容持续更新和优化',
      gradient: 'from-indigo-500 to-blue-500'
    },
    {
      icon: Zap,
      title: '高性能体验',
      description: '优化的系统架构和响应式设计，确保流畅的用户体验',
      gradient: 'from-yellow-500 to-orange-500'
    },
    {
      icon: Award,
      title: '权威认证',
      description: '通过多项教育质量认证，值得信赖的专业学习平台',
      gradient: 'from-purple-500 to-pink-500'
    }
  ];

  const stats = [
    { label: '注册学员', value: '50,000+', icon: Users },
    { label: '题目总数', value: '100,000+', icon: BookOpen },
    { label: '考试完成', value: '1,000,000+', icon: CheckCircle },
    { label: '平均提分', value: '85%', icon: TrendingUp }
  ];

  const testimonials = [
    {
      name: '张同学',
      role: '高三学生',
      content: '使用智能题库后，我的数学成绩提升了30分！AI推荐功能真的很精准，每次练习都很有针对性。',
      avatar: '🎓',
      rating: 5
    },
    {
      name: '李老师',
      role: '数学教师',
      content: '这个系统大大减轻了我的工作负担，自动批改和数据分析功能让我能更好地了解学生的学习情况。',
      avatar: '👨‍🏫',
      rating: 5
    },
    {
      name: '王同学',
      role: '大学生',
      content: '错题本功能特别实用，帮助我很好地复习和巩固知识点。界面设计也很现代化，使用体验很棒！',
      avatar: '👩‍🎓',
      rating: 5
    }
  ];

  const HeroSection = () => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    
    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 20;
        const y = (e.clientY / window.innerHeight - 0.5) * 20;
        setMousePosition({ x, y });
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);
    
    return (
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background with parallax effect */}
        <div 
          className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 transition-transform duration-300 ease-out"
          style={{
            transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)`
          }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-20" />
          
          {/* Animated background elements */}
          <div 
            className="absolute top-1/4 left-1/4 w-64 h-64 bg-white bg-opacity-10 rounded-full blur-3xl animate-float transition-transform duration-300"
            style={{ 
              animationDelay: '0s',
              transform: `translate(${mousePosition.x * 0.5}px, ${mousePosition.y * 0.5}px)`
            }} 
          />
          <div 
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 bg-opacity-10 rounded-full blur-3xl animate-float transition-transform duration-300"
            style={{ 
              animationDelay: '1s',
              transform: `translate(${mousePosition.x * -0.3}px, ${mousePosition.y * -0.3}px)`
            }} 
          />
          <div 
            className="absolute top-1/2 right-1/3 w-48 h-48 bg-blue-500 bg-opacity-10 rounded-full blur-3xl animate-float transition-transform duration-300"
            style={{ 
              animationDelay: '2s',
              transform: `translate(${mousePosition.x * 0.7}px, ${mousePosition.y * 0.7}px)`
            }} 
          />
        </div>

        <div className="relative z-10 container-responsive text-center">
          <div className="max-w-4xl mx-auto">
            {/* Main heading with animated gradient */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 animate-slide-up">
              <span className="gradient-text-primary bg-gradient-to-r from-white to-primary-200 bg-clip-text text-transparent">
                智能题库
              </span>
              <span className="block text-3xl md:text-5xl lg:text-6xl font-light text-primary-100 mt-2 animate-delay-200">
                个性化学习平台
              </span>
            </h1>

            {/* Subtitle with typing effect */}
            <p className="text-xl md:text-2xl text-primary-100 mb-8 max-w-2xl mx-auto leading-relaxed animate-slide-up animate-delay-300">
              基于AI技术的智能题库系统，为每位学习者提供个性化的学习体验，
              让学习更高效、更精准、更有趣。
            </p>

            {/* CTA Buttons with hover effects */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up animate-delay-400">
              {!isAuthenticated ? (
                <>
                  <Button
                    size="xl"
                    icon={<Play className="h-6 w-6" />}
                    iconPosition="left"
                    onClick={() => navigate('/register')}
                    className="bg-white text-primary-600 hover:bg-primary-50 shadow-strong hover:shadow-glow-strong transform hover:scale-105 active:scale-95 transition-all duration-300 animate-pulse-soft"
                  >
                    免费开始学习
                  </Button>
                  <Button
                    size="xl"
                    variant="outline"
                    onClick={() => navigate('/login')}
                    className="border-white text-white hover:bg-white hover:text-primary-600 transform hover:scale-105 active:scale-95 transition-all duration-300"
                  >
                    登录账户
                  </Button>
                </>
              ) : (
                <Button
                  size="xl"
                  icon={<Play className="h-6 w-6" />}
                  iconPosition="left"
                  onClick={() => navigate('/practice')}
                  className="bg-white text-primary-600 hover:bg-primary-50 shadow-strong hover:shadow-glow-strong transform hover:scale-105 active:scale-95 transition-all duration-300 animate-pulse-soft"
                >
                  继续学习
                </Button>
              )}
            </div>

            {/* Stats with counter animation */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 animate-slide-up animate-delay-500">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div 
                    key={index} 
                    className="text-center group cursor-pointer transform hover:scale-105 transition-all duration-300"
                  >
                    <div className="flex items-center justify-center mb-2 group-hover:animate-bounce-soft">
                      <Icon className="h-8 w-8 text-primary-200 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-2xl md:text-3xl font-bold text-white mb-1 group-hover:text-primary-100 transition-colors">
                      {stat.value}
                    </div>
                    <div className="text-sm text-primary-200 group-hover:text-white transition-colors">
                      {stat.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scroll indicator with gradient */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white animate-bounce group cursor-pointer">
          <div className="flex flex-col items-center space-y-2 group-hover:space-y-3 transition-all">
            <span className="text-sm font-medium group-hover:text-primary-100 transition-colors">向下滚动</span>
            <ArrowRight className="h-6 w-6 rotate-90 group-hover:rotate-90 group-hover:scale-110 transition-all" />
          </div>
        </div>
      </section>
    );
  };

  const FeaturesSection = () => (
    <section className="py-20 lg:py-32 bg-white dark:bg-secondary-900">
      <div className="container-responsive">
        <div className="text-center mb-16 lg:mb-20">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent mb-6">
            核心功能
          </h2>
          <p className="text-xl text-secondary-600 dark:text-secondary-400 max-w-3xl mx-auto">
            全面的学习解决方案，利用AI技术为每位用户提供个性化的学习体验
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Link
                key={index}
                to={isAuthenticated ? feature.href : '/login'}
                className="group block p-8 bg-gradient-to-br from-white to-secondary-50 dark:from-secondary-800 dark:to-secondary-900 rounded-2xl shadow-soft hover:shadow-medium border border-secondary-100 dark:border-secondary-800 transition-all duration-300 hover:-translate-y-2"
              >
                <div className={cn(
                  "inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br rounded-2xl mb-6 shadow-soft group-hover:scale-110 transition-transform",
                  feature.color
                )}>
                  <Icon className="h-8 w-8 text-white" />
                </div>
                
                <h3 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100 mb-4 group-hover:text-primary-600 transition-colors">
                  {feature.title}
                </h3>
                
                <p className="text-secondary-600 dark:text-secondary-400 mb-6 leading-relaxed">
                  {feature.description}
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-secondary-500 dark:text-secondary-500">
                    <Star className="h-4 w-4 text-yellow-500 mr-2" />
                    {feature.stats}
                  </div>
                  
                  <div className="space-y-2">
                    {feature.features.map((item, idx) => (
                      <div key={idx} className="flex items-center text-sm text-secondary-600 dark:text-secondary-400">
                        <CheckCircle className="h-3 w-3 text-success mr-2 flex-shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="mt-6 flex items-center text-primary-600 group-hover:text-primary-700 font-medium">
                  <span>了解更多</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );

  const AdvantagesSection = () => (
    <section className="py-20 lg:py-32 bg-secondary-50 dark:bg-secondary-950">
      <div className="container-responsive">
        <div className="text-center mb-16 lg:mb-20">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-secondary-900 dark:text-secondary-100 mb-6">
            为什么选择我们
          </h2>
          <p className="text-xl text-secondary-600 dark:text-secondary-400 max-w-3xl mx-auto">
            专业、智能、安全的学习平台，为您提供卓越的学习体验
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
          {advantages.map((advantage, index) => {
            const Icon = advantage.icon;
            return (
              <div key={index} className="group text-center">
                <div className={cn(
                  "inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br rounded-3xl mb-8 shadow-strong group-hover:shadow-glow transition-all duration-300 group-hover:scale-110",
                  advantage.gradient
                )}>
                  <Icon className="h-10 w-10 text-white" />
                </div>
                
                <h3 className="text-2xl font-bold text-secondary-900 dark:text-secondary-100 mb-4 group-hover:text-primary-600 transition-colors">
                  {advantage.title}
                </h3>
                
                <p className="text-secondary-600 dark:text-secondary-400 leading-relaxed">
                  {advantage.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );

  const TestimonialsSection = () => (
    <section className="py-20 lg:py-32 bg-white dark:bg-secondary-900">
      <div className="container-responsive">
        <div className="text-center mb-16 lg:mb-20">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent mb-6">
            用户评价
          </h2>
          <p className="text-xl text-secondary-600 dark:text-secondary-400 max-w-3xl mx-auto">
            听听我们用户的真实反馈
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="bg-secondary-50 dark:bg-secondary-800 rounded-2xl p-8 shadow-soft hover:shadow-medium transition-all duration-300">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center text-xl font-bold text-white mr-4">
                  {testimonial.avatar}
                </div>
                <div>
                  <h4 className="font-semibold text-secondary-900 dark:text-secondary-100">{testimonial.name}</h4>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400">{testimonial.role}</p>
                </div>
              </div>
              
              <p className="text-secondary-700 dark:text-secondary-300 leading-relaxed mb-4">
                "{testimonial.content}"
              </p>
              
              <div className="flex items-center">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const CTASection = () => (
    <section className="py-20 lg:py-32 bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div
          className="absolute top-0 left-0 w-full h-full opacity-30"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            backgroundRepeat: 'repeat',
          }}
        />
      </div>

      <div className="container-responsive relative z-10 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            准备好开始学习了吗？
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            加入我们的智能题库系统，开启个性化学习之旅。立即注册，体验AI驱动的智能学习。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {!isAuthenticated ? (
              <>
                <Button
                  size="xl"
                  icon={<Play className="h-6 w-6" />}
                  iconPosition="left"
                  onClick={() => navigate('/register')}
                  className="bg-white text-primary-600 hover:bg-primary-50 shadow-strong hover:shadow-glow-strong transition-all duration-300"
                >
                  免费注册
                </Button>
                <Button
                  size="xl"
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="border-white text-white hover:bg-white hover:text-primary-600 transition-all duration-300"
                >
                  登录账户
                </Button>
              </>
            ) : (
              <Button
                size="xl"
                icon={<Play className="h-6 w-6" />}
                iconPosition="left"
                onClick={() => navigate('/practice')}
                className="bg-white text-primary-600 hover:bg-primary-50 shadow-strong hover:shadow-glow-strong transition-all duration-300"
              >
                继续学习
              </Button>
            )}
          </div>

          <div className="mt-12 flex flex-wrap justify-center items-center gap-8 text-primary-200">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>安全可靠</span>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>快速响应</span>
            </div>
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5" />
              <span>AI驱动</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-secondary-900">
      <HeroSection />
      <FeaturesSection />
      <AdvantagesSection />
      <TestimonialsSection />
      <CTASection />
    </div>
  );
}
