import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/Button';
import { questionService, type PublicTotals } from '../services/questionService';
import { metaService, type DeploymentMeta } from '../services/metaService';
import { PROJECT_LINKS } from '../config/projectLinks';
import {
  BookOpen,
  PenTool,
  FileText,
  Target,
  BarChart3,
  Play,
  Shield,
  Users,
  ArrowRight,
  Layers,
  Github,
  ExternalLink,
  Database,
  Server,
  Mail,
  Sparkles,
  KeyRound,
  Terminal,
  ScrollText,
  LifeBuoy,
  CheckCircle,
  Package,
} from 'lucide-react';
import { cn } from '../lib/utils';

const formatCount = (value?: number) =>
  typeof value === 'number' ? new Intl.NumberFormat('zh-CN').format(value) : '—';

const features = [
  {
    icon: PenTool,
    title: '专题练习',
    description: '按专题与章节浏览题目，支持顺序或随机练习，提交后即时判题并显示解析。',
    points: ['按专题选择题目', '即时判题与解析', '练习记录自动保存'],
    href: '/practice',
    iconClass: 'from-amber-500 to-orange-500',
    borderClass: 'hover:border-amber-300 dark:hover:border-amber-700',
  },
  {
    icon: FileText,
    title: '模拟考试',
    description: '教师从题库组卷并发布考试，学生在限定时间内作答，提交后自动评分。',
    points: ['限时作答', '自动评分', '成绩与答卷记录'],
    href: '/exam',
    iconClass: 'from-emerald-500 to-teal-500',
    borderClass: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    icon: Target,
    title: '错题本',
    description: '练习与考试中的错题自动收集，可按掌握状态筛选并随时重新练习。',
    points: ['自动收集错题', '标记已掌握', '随时重新练习'],
    href: '/wrongbook',
    iconClass: 'from-rose-500 to-pink-500',
    borderClass: 'hover:border-rose-300 dark:hover:border-rose-700',
  },
  {
    icon: BarChart3,
    title: '学习记录',
    description: '查看练习与考试的历史记录、作答数量与正确率，了解自己的学习进度。',
    points: ['练习历史', '考试历史', '正确率统计'],
    href: '/record',
    iconClass: 'from-violet-500 to-purple-500',
    borderClass: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
];

const adminFeatures = [
  {
    icon: BookOpen,
    title: '题库管理',
    description: '创建专题与章节，录入、编辑和删除题目，支持 Excel / JSON 批量导入。',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
  },
  {
    icon: FileText,
    title: '考试管理',
    description: '从题库组卷、发布考试，查看学生提交与成绩。',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  {
    icon: Users,
    title: '用户管理',
    description: '创建学生与教师账号、重置密码；临时密码在首次登录时强制修改。',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
  },
  {
    icon: Shield,
    title: '账号安全',
    description: 'JWT 会话校验、一次性密码重置令牌，改密后旧会话立即失效。',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
  },
];

const deploySteps = [
  { command: 'npm ci', note: '安装依赖' },
  { command: 'npm run env:init', note: '生成 .env 与随机 JWT_SECRET' },
  { command: 'npm run setup', note: '执行迁移并导入题库' },
  { command: 'npm run build:all', note: '构建前端与后端' },
  { command: 'npm start', note: '启动生产服务' },
];

const deployTraits = [
  {
    icon: Database,
    title: 'SQLite 单文件数据库',
    description: '无需额外数据库服务，数据保存在 var/question-bank.db。',
  },
  {
    icon: Server,
    title: '同源部署',
    description: '生产模式下 Express 直接托管前端静态文件，只需一个进程。',
  },
  {
    icon: Mail,
    title: 'SMTP 可选',
    description: '未配置 SMTP 时关闭邮箱验证与自助注册，账号由管理员创建。',
  },
  {
    icon: Sparkles,
    title: 'AI 功能可选',
    description: '通过 AI_ENABLED 控制，未启用时相关接口返回明确错误。',
  },
];

const communityLinks = [
  {
    icon: Github,
    title: 'GitHub 仓库',
    description: '查看源码、提交记录与版本发布。',
    href: PROJECT_LINKS.repository,
  },
  {
    icon: LifeBuoy,
    title: '问题反馈',
    description: '通过 Issues 报告缺陷或提出功能建议。',
    href: PROJECT_LINKS.issues,
  },
  {
    icon: Shield,
    title: '安全政策',
    description: '安全问题请按 SECURITY.md 私下报告，不要开公开 issue。',
    href: PROJECT_LINKS.security,
  },
  {
    icon: ScrollText,
    title: '贡献指南',
    description: '开发环境、提交规范与 PR 要求。',
    href: PROJECT_LINKS.contributing,
  },
  {
    icon: Package,
    title: '版本记录',
    description: '查看 CHANGELOG 与历次发布说明。',
    href: PROJECT_LINKS.changelog,
  },
];

function HeroSection({
  isAuthenticated,
  navigate,
  totals,
  meta,
}: {
  isAuthenticated: boolean;
  navigate: ReturnType<typeof useNavigate>;
  totals: PublicTotals | null;
  meta: DeploymentMeta | null;
}) {
  const stats = [
    { label: '专题', value: formatCount(totals?.topics), icon: Layers },
    { label: '题目', value: formatCount(totals?.questions), icon: BookOpen },
    { label: '选项', value: formatCount(totals?.options), icon: CheckCircle },
    { label: '用户角色', value: '3', icon: Users },
  ];

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

      {/* Decorative orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-300/15 dark:bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-300/10 dark:bg-emerald-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 container-responsive text-center py-20">
        <div className="max-w-4xl mx-auto">
          {/* Project Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100/80 border border-amber-200 backdrop-blur-sm dark:bg-white/5 dark:border-white/10 dark:backdrop-blur-sm mb-8">
            <Github className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <span className="text-sm text-amber-800 tracking-wide dark:text-slate-300">
              开源 · 自托管 · SQLite
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold text-secondary-900 dark:text-white leading-tight mb-8">
            <span className="block">思政复习题库</span>
            <span className="block text-2xl md:text-3xl lg:text-4xl font-normal text-secondary-500 dark:text-slate-400 mt-3 font-sans">
              开源题库练习与自测系统
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-secondary-500 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            一套可自托管的题库、练习、模拟考试与错题复习系统。代码以 MIT 发布，题库数据以
            CC BY 4.0 发布，所有数据保存在你自己的 SQLite 数据库中。
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6 w-full">
            {!isAuthenticated ? (
              <>
                <Button
                  className="w-full sm:w-auto bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/25 transition-all duration-300 px-8"
                  icon={<Play className="h-5 w-5" />}
                  iconPosition="left"
                  size="xl"
                  onClick={() => navigate('/login')}
                >
                  登录系统
                </Button>
                {meta?.registrationEnabled && (
                  <Button
                    className="w-full sm:w-auto border-secondary-300 text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900 hover:border-secondary-400 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-slate-500 transition-all duration-300 px-8"
                    icon={<Users className="h-5 w-5" />}
                    iconPosition="left"
                    size="xl"
                    variant="outline"
                    onClick={() => navigate('/register')}
                  >
                    注册账号
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  className="w-full sm:w-auto bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/25 transition-all duration-300 px-8"
                  icon={<Play className="h-5 w-5" />}
                  iconPosition="left"
                  size="xl"
                  onClick={() => navigate('/practice')}
                >
                  继续练习
                </Button>
                <Button
                  className="w-full sm:w-auto border-secondary-300 text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900 hover:border-secondary-400 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-slate-500 transition-all duration-300 px-8"
                  icon={<FileText className="h-5 w-5" />}
                  iconPosition="left"
                  size="xl"
                  variant="outline"
                  onClick={() => navigate('/exam')}
                >
                  考试中心
                </Button>
              </>
            )}
            <a
              href={PROJECT_LINKS.repository}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 h-[52px] rounded-xl border border-secondary-300 text-secondary-600 font-medium transition-colors hover:bg-secondary-100 hover:text-secondary-900 hover:border-secondary-400 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-slate-500"
            >
              <Github className="h-5 w-5" />
              GitHub 源码
            </a>
          </div>

          {!isAuthenticated && meta && !meta.registrationEnabled && (
            <p className="text-sm text-secondary-400 dark:text-slate-500 mb-12">
              当前部署未启用自助注册，账号由管理员创建。
            </p>
          )}

          {/* Real Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 max-w-3xl mx-auto">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div className="text-center" key={stat.label}>
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
          <p className="mt-4 text-xs text-secondary-400 dark:text-slate-500">
            {totals ? '统计数据来自当前部署的数据库' : '统计数据暂不可用'}
          </p>
        </div>
      </div>

      {/* Bottom Fade */}
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
            系统功能
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-900 dark:text-secondary-100 mb-4">
            从练习到考试的完整流程
          </h2>
          <p className="text-lg text-secondary-500 dark:text-secondary-400 max-w-2xl mx-auto">
            以下功能均可在本仓库中直接使用，没有未实现的占位入口。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link
                key={feature.title}
                to={feature.href}
                className={cn(
                  'group block p-6 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800 transition-all duration-300 hover:shadow-lg cursor-pointer',
                  feature.borderClass,
                )}
              >
                <div
                  className={cn(
                    'inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br rounded-xl mb-5 shadow-sm',
                    feature.iconClass,
                  )}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>

                <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 mb-2">
                  {feature.title}
                </h3>

                <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-5 leading-relaxed">
                  {feature.description}
                </p>

                <div className="space-y-2">
                  {feature.points.map((item) => (
                    <div
                      className="flex items-center text-sm text-secondary-600 dark:text-secondary-400"
                      key={item}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-2 flex-shrink-0 text-emerald-500 dark:text-emerald-400" />
                      {item}
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center text-sm font-medium text-secondary-400 group-hover:text-secondary-600 dark:group-hover:text-secondary-300 transition-colors">
                  进入功能
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

function AdminSection() {
  return (
    <section className="py-20 lg:py-28 bg-white dark:bg-secondary-900">
      <div className="container-responsive">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium mb-4">
            <KeyRound className="h-4 w-4" />
            教师与管理员
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-900 dark:text-secondary-100 mb-4">
            题库维护与考试组织
          </h2>
          <p className="text-lg text-secondary-500 dark:text-secondary-400 max-w-2xl mx-auto">
            学生、教师、管理员三种角色，按权限访问对应功能。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {adminFeatures.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="group p-6 rounded-2xl transition-all duration-300 hover:bg-secondary-50 dark:hover:bg-secondary-800/50"
              >
                <div
                  className={cn(
                    'inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 transition-transform group-hover:scale-110',
                    item.color,
                    item.bg,
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <h3 className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 mb-2">
                  {item.title}
                </h3>

                <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SelfHostingSection() {
  return (
    <section className="py-20 lg:py-28 bg-secondary-50 dark:bg-secondary-950">
      <div className="container-responsive">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm font-medium mb-4">
            <Terminal className="h-4 w-4" />
            自托管部署
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-900 dark:text-secondary-100 mb-4">
            数据留在你自己的服务器上
          </h2>
          <p className="text-lg text-secondary-500 dark:text-secondary-400 max-w-2xl mx-auto">
            使用 Node.js 22、Express、Prisma 与 SQLite。生产模式下前后端同源运行，不需要额外的数据库服务。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="rounded-2xl bg-slate-950 dark:bg-black/40 border border-slate-800 overflow-hidden shadow-lg">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-400/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-xs text-slate-400">快速开始</span>
            </div>
            <div className="p-5 space-y-3 font-mono text-sm">
              {deploySteps.map((step) => (
                <div key={step.command} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
                  <code className="text-emerald-400 whitespace-nowrap">$ {step.command}</code>
                  <span className="text-xs text-slate-500 font-sans">{step.note}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-400 leading-relaxed">
              首次运行 <code className="text-slate-300">npm run setup</code> 前，请在
              <code className="text-slate-300"> .env </code>
              中配置管理员账号，或使用
              <code className="text-slate-300"> SEED_DEMO=true </code>
              导入演示账号。完整说明见
              <a
                href={PROJECT_LINKS.readme}
                target="_blank"
                rel="noreferrer"
                className="ml-1 text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
              >
                README
                <ExternalLink className="h-3 w-3" />
              </a>
              。
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {deployTraits.map((trait) => {
              const Icon = trait.icon;
              return (
                <div
                  key={trait.title}
                  className="p-5 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800"
                >
                  <Icon className="h-5 w-5 text-amber-500 dark:text-amber-400 mb-3" />
                  <h3 className="text-sm font-semibold text-secondary-900 dark:text-secondary-100 mb-1.5">
                    {trait.title}
                  </h3>
                  <p className="text-xs text-secondary-500 dark:text-secondary-400 leading-relaxed">
                    {trait.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href={PROJECT_LINKS.license}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-3 p-5 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
          >
            <Shield className="h-5 w-5 text-amber-500 dark:text-amber-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-secondary-900 dark:text-secondary-100">
                代码许可证：MIT
              </h3>
              <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                可自由使用、修改与分发，保留版权声明即可。
              </p>
            </div>
          </a>
          <a
            href={PROJECT_LINKS.dataLicense}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-3 p-5 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
          >
            <BookOpen className="h-5 w-5 text-emerald-500 dark:text-emerald-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-secondary-900 dark:text-secondary-100">
                题库数据：CC BY 4.0
              </h3>
              <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                转载或改编题库时请保留署名，来源见 data/ATTRIBUTION.md。
              </p>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}

function CommunitySection() {
  return (
    <section className="py-20 lg:py-28 bg-white dark:bg-secondary-900">
      <div className="container-responsive">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-sm font-medium mb-4">
            <Github className="h-4 w-4" />
            开源项目
          </div>
          <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-900 dark:text-secondary-100 mb-4">
            参与与反馈
          </h2>
          <p className="text-lg text-secondary-500 dark:text-secondary-400 max-w-2xl mx-auto">
            项目以源码形式公开。欢迎提交 issue、改进文档或贡献代码。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {communityLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.title}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-4 p-6 rounded-2xl border border-secondary-200 dark:border-secondary-800 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md transition-all"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-300 flex-shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-secondary-900 dark:text-secondary-100">
                    {link.title}
                    <ExternalLink className="h-3.5 w-3.5 text-secondary-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1 leading-relaxed">
                    {link.description}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [totals, setTotals] = useState<PublicTotals | null>(null);
  const [meta, setMeta] = useState<DeploymentMeta | null>(null);

  useEffect(() => {
    let active = true;

    questionService
      .getPublicStats()
      .then((response) => {
        if (active) setTotals(response.data?.totals ?? null);
      })
      .catch(() => {
        if (active) setTotals(null);
      });

    metaService
      .getMeta()
      .then((response) => {
        if (active) setMeta(response.data ?? null);
      })
      .catch(() => {
        if (active) setMeta(null);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-950">
      <HeroSection
        isAuthenticated={isAuthenticated}
        navigate={navigate}
        totals={totals}
        meta={meta}
      />
      <FeaturesSection />
      <AdminSection />
      <SelfHostingSection />
      <CommunitySection />

      <footer className="bg-secondary-100 dark:bg-secondary-950 border-t border-secondary-200 dark:border-secondary-800">
        <div className="container-responsive py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-400">
              <BookOpen className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-secondary-900 dark:text-secondary-200">
                question-bank
              </span>
              {meta?.version && <span className="text-secondary-400">v{meta.version}</span>}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-secondary-500 dark:text-secondary-400">
              <a
                href={PROJECT_LINKS.repository}
                target="_blank"
                rel="noreferrer"
                className="hover:text-amber-600 dark:hover:text-amber-400"
              >
                GitHub
              </a>
              <a
                href={PROJECT_LINKS.license}
                target="_blank"
                rel="noreferrer"
                className="hover:text-amber-600 dark:hover:text-amber-400"
              >
                代码 MIT
              </a>
              <a
                href={PROJECT_LINKS.dataLicense}
                target="_blank"
                rel="noreferrer"
                className="hover:text-amber-600 dark:hover:text-amber-400"
              >
                数据 CC BY 4.0
              </a>
              <Link
                to="/login"
                className="hover:text-amber-600 dark:hover:text-amber-400"
              >
                登录
              </Link>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-secondary-400 dark:text-secondary-500">
            本项目是课堂练习与自测工具，不承诺防作弊或考试安全。题库内容请自行核对适用性。
          </p>
        </div>
      </footer>
    </div>
  );
}
