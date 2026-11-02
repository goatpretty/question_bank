import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardBody, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { metaService, type DeploymentMeta } from '../../services/metaService'
import {
  systemSettingsService,
  type AdminSystemSettings,
  type AiSettingsPayload,
  type SettingsSource,
  type SmtpSettingsPayload,
} from '../../services/systemSettingsService'
import { PROJECT_LINKS } from '../../config/projectLinks'
import { cn } from '../../lib/utils'
import {
  Server,
  ShieldCheck,
  Github,
  ExternalLink,
  BookOpen,
  ScrollText,
  LifeBuoy,
  Mail,
  Sparkles,
  Save,
  RotateCcw,
  Send,
  PlugZap,
  Database,
} from 'lucide-react'

const projectDocs = [
  { label: 'GitHub 仓库', href: PROJECT_LINKS.repository, icon: Github },
  { label: 'README / 部署说明', href: PROJECT_LINKS.readme, icon: BookOpen },
  { label: '问题反馈（Issues）', href: PROJECT_LINKS.issues, icon: LifeBuoy },
  { label: '安全政策（SECURITY.md）', href: PROJECT_LINKS.security, icon: ShieldCheck },
  { label: '贡献指南（CONTRIBUTING.md）', href: PROJECT_LINKS.contributing, icon: ScrollText },
  { label: '版本记录（CHANGELOG.md）', href: PROJECT_LINKS.changelog, icon: ScrollText },
]

interface SmtpForm {
  enabled: boolean
  host: string
  port: string
  secure: boolean
  user: string
  from: string
  password: string
}

interface AiForm {
  enabled: boolean
  baseUrl: string
  model: string
  apiKey: string
}

interface Feedback {
  type: 'success' | 'error'
  text: string
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-secondary-100 dark:border-secondary-800 last:border-b-0">
      <span className="text-sm text-secondary-500 dark:text-secondary-400">{label}</span>
      <span className="text-sm text-right text-secondary-900 dark:text-secondary-100 break-all">
        {children}
      </span>
    </div>
  )
}

function MetaLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  )
}

function SourceBadge({ source }: { source: SettingsSource }) {
  const fromDatabase = source === 'database'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        fromDatabase
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          : 'bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300',
      )}
    >
      <Database className="h-3 w-3" />
      {fromDatabase ? '数据库配置' : '环境变量配置'}
    </span>
  )
}

function Toggle({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <p id={`${id}-label`} className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
          {label}
        </p>
        <p className="mt-0.5 text-xs text-secondary-500 dark:text-secondary-400">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-secondary-900',
          checked ? 'bg-amber-500' : 'bg-secondary-300 dark:bg-secondary-700',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  )
}

function FeedbackMessage({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null
  return (
    <p
      role={feedback.type === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg px-3 py-2 text-sm',
        feedback.type === 'success'
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
      )}
    >
      {feedback.text}
    </p>
  )
}

function smtpFormFrom(settings: AdminSystemSettings['smtp']): SmtpForm {
  return {
    enabled: settings.enabled,
    host: settings.host,
    port: String(settings.port),
    secure: settings.secure,
    user: settings.user,
    from: settings.from,
    password: '',
  }
}

function aiFormFrom(settings: AdminSystemSettings['ai']): AiForm {
  return {
    enabled: settings.enabled,
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKey: '',
  }
}

export default function AdminSettings() {
  const [meta, setMeta] = useState<DeploymentMeta | null>(null)
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [smtpForm, setSmtpForm] = useState<SmtpForm>({
    enabled: false,
    host: '',
    port: '465',
    secure: true,
    user: '',
    from: '',
    password: '',
  })
  const [aiForm, setAiForm] = useState<AiForm>({
    enabled: false,
    baseUrl: '',
    model: '',
    apiKey: '',
  })
  const [smtpFeedback, setSmtpFeedback] = useState<Feedback | null>(null)
  const [aiFeedback, setAiFeedback] = useState<Feedback | null>(null)
  const [savingSmtp, setSavingSmtp] = useState(false)
  const [savingAi, setSavingAi] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testingAi, setTestingAi] = useState(false)
  const [resetting, setResetting] = useState<'smtp' | 'ai' | null>(null)
  const [testEmailTo, setTestEmailTo] = useState('')

  const refreshMeta = useCallback(async () => {
    try {
      const response = await metaService.getMeta()
      if (response.data) setMeta(response.data)
    } catch {
      // 部署信息刷新失败不影响设置表单本身。
    }
  }, [])

  const applySettings = useCallback((data: AdminSystemSettings) => {
    setSettings(data)
    setSmtpForm(smtpFormFrom(data.smtp))
    setAiForm(aiFormFrom(data.ai))
  }, [])

  useEffect(() => {
    let active = true

    Promise.allSettled([metaService.getMeta(), systemSettingsService.getSettings()])
      .then(([metaResult, settingsResult]) => {
        if (!active) return

        if (metaResult.status === 'fulfilled' && metaResult.value.data) {
          setMeta(metaResult.value.data)
        }

        if (settingsResult.status === 'fulfilled' && settingsResult.value.data) {
          applySettings(settingsResult.value.data)
          setFailed(false)
        } else {
          setFailed(true)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [applySettings])

  const saveSmtp = async (event: React.FormEvent) => {
    event.preventDefault()
    setSmtpFeedback(null)

    const port = Number.parseInt(smtpForm.port, 10)
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      setSmtpFeedback({ type: 'error', text: 'SMTP 端口必须是 1 到 65535 之间的整数。' })
      return
    }

    const payload: SmtpSettingsPayload = {
      enabled: smtpForm.enabled,
      host: smtpForm.host.trim(),
      port,
      secure: smtpForm.secure,
      user: smtpForm.user.trim(),
      from: smtpForm.from.trim(),
    }
    if (smtpForm.password) payload.password = smtpForm.password

    setSavingSmtp(true)
    try {
      const response = await systemSettingsService.updateSettings({ smtp: payload })
      applySettings(response.data)
      setSmtpFeedback({ type: 'success', text: response.message || 'SMTP 设置已保存。' })
      await refreshMeta()
    } catch (error) {
      setSmtpFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : '保存 SMTP 设置失败。',
      })
    } finally {
      setSavingSmtp(false)
    }
  }

  const saveAi = async (event: React.FormEvent) => {
    event.preventDefault()
    setAiFeedback(null)

    const payload: AiSettingsPayload = {
      enabled: aiForm.enabled,
      baseUrl: aiForm.baseUrl.trim(),
      model: aiForm.model.trim(),
    }
    if (aiForm.apiKey) payload.apiKey = aiForm.apiKey

    setSavingAi(true)
    try {
      const response = await systemSettingsService.updateSettings({ ai: payload })
      applySettings(response.data)
      setAiFeedback({ type: 'success', text: response.message || 'AI 设置已保存。' })
      await refreshMeta()
    } catch (error) {
      setAiFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : '保存 AI 设置失败。',
      })
    } finally {
      setSavingAi(false)
    }
  }

  const testEmail = async () => {
    setSmtpFeedback(null)
    setTestingEmail(true)
    try {
      const response = await systemSettingsService.sendTestEmail(testEmailTo.trim() || undefined)
      setSmtpFeedback({
        type: response.success ? 'success' : 'error',
        text: response.message || (response.success ? '测试邮件已发送。' : '测试邮件发送失败。'),
      })
    } catch (error) {
      setSmtpFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : '测试邮件发送失败。',
      })
    } finally {
      setTestingEmail(false)
    }
  }

  const testAi = async () => {
    setAiFeedback(null)
    setTestingAi(true)
    try {
      const response = await systemSettingsService.testAi()
      setAiFeedback({
        type: response.success ? 'success' : 'error',
        text: response.message || (response.success ? 'AI 连接成功。' : 'AI 连接失败。'),
      })
    } catch (error) {
      setAiFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'AI 连接失败。',
      })
    } finally {
      setTestingAi(false)
    }
  }

  const resetSection = async (section: 'smtp' | 'ai') => {
    const label = section === 'smtp' ? 'SMTP' : 'AI'
    if (!window.confirm(`确定要清除数据库中保存的 ${label} 设置，恢复为 .env 环境变量配置吗？`)) {
      return
    }

    setResetting(section)
    const setFeedback = section === 'smtp' ? setSmtpFeedback : setAiFeedback
    setFeedback(null)
    try {
      const response = await systemSettingsService.resetSection(section)
      applySettings(response.data)
      setFeedback({ type: 'success', text: response.message || `已恢复 ${label} 的环境变量配置。` })
      await refreshMeta()
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : `重置 ${label} 设置失败。`,
      })
    } finally {
      setResetting(null)
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <Card hover={false}>
          <CardBody>
            <p className="text-sm text-secondary-500 dark:text-secondary-400">正在读取系统设置…</p>
          </CardBody>
        </Card>
      ) : failed || !settings ? (
        <Card hover={false}>
          <CardBody>
            <p className="text-sm text-rose-600 dark:text-rose-400">
              无法读取系统设置，请确认后端服务与 /api/admin/settings 可访问。
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <Card hover={false}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-amber-500" />
                    SMTP 邮件服务
                  </CardTitle>
                  <CardDescription className="mt-1">
                    用于注册、找回密码等验证码邮件。保存后立即生效，无需重启服务。
                  </CardDescription>
                </div>
                <SourceBadge source={settings.smtp.source} />
              </div>
            </CardHeader>
            <CardBody>
              <form className="space-y-4" onSubmit={saveSmtp}>
                <Toggle
                  id="smtp-enabled"
                  checked={smtpForm.enabled}
                  onChange={(enabled) => setSmtpForm((form) => ({ ...form, enabled }))}
                  label="启用 SMTP"
                  description="关闭后，注册、登录验证码等依赖邮件的功能将不可用。"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="服务器地址"
                    placeholder="smtp.example.com"
                    value={smtpForm.host}
                    onChange={(event) => setSmtpForm((form) => ({ ...form, host: event.target.value }))}
                  />
                  <Input
                    label="端口"
                    type="number"
                    min={1}
                    max={65535}
                    value={smtpForm.port}
                    onChange={(event) => setSmtpForm((form) => ({ ...form, port: event.target.value }))}
                  />
                  <Input
                    label="用户名"
                    autoComplete="username"
                    value={smtpForm.user}
                    onChange={(event) => setSmtpForm((form) => ({ ...form, user: event.target.value }))}
                  />
                  <Input
                    label="密码 / 授权码"
                    type="password"
                    autoComplete="new-password"
                    placeholder={settings.smtp.hasPassword ? '已保存，留空保持不变' : '请输入密码或授权码'}
                    helperText={settings.smtp.hasPassword ? '出于安全考虑不回显，填写新值才会覆盖。' : undefined}
                    value={smtpForm.password}
                    onChange={(event) => setSmtpForm((form) => ({ ...form, password: event.target.value }))}
                  />
                  <Input
                    label="发件人地址"
                    type="email"
                    placeholder="noreply@example.com"
                    value={smtpForm.from}
                    onChange={(event) => setSmtpForm((form) => ({ ...form, from: event.target.value }))}
                  />
                  <div className="flex items-end pb-1">
                    <Toggle
                      id="smtp-secure"
                      checked={smtpForm.secure}
                      onChange={(secure) => setSmtpForm((form) => ({ ...form, secure }))}
                      label="使用加密连接（SSL/TLS）"
                      description="465 端口通常开启；587 端口通常使用 STARTTLS。"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-secondary-200 dark:border-secondary-800 p-3 space-y-2">
                  <p className="text-sm font-medium text-secondary-900 dark:text-secondary-100">发送测试邮件</p>
                  <p className="text-xs text-secondary-500 dark:text-secondary-400">
                    使用已保存的配置发送，留空则发到当前管理员邮箱。
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <Input
                      containerClassName="flex-1"
                      label="收件邮箱"
                      type="email"
                      placeholder="留空则发送到当前管理员邮箱"
                      value={testEmailTo}
                      onChange={(event) => setTestEmailTo(event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={testingEmail}
                      icon={<Send className="h-4 w-4" />}
                      onClick={testEmail}
                    >
                      发送测试
                    </Button>
                  </div>
                </div>

                <FeedbackMessage feedback={smtpFeedback} />

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" loading={savingSmtp} icon={<Save className="h-4 w-4" />}>
                    保存 SMTP 设置
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    loading={resetting === 'smtp'}
                    icon={<RotateCcw className="h-4 w-4" />}
                    onClick={() => resetSection('smtp')}
                  >
                    恢复 .env 配置
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card hover={false}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    AI 学习助手
                  </CardTitle>
                  <CardDescription className="mt-1">
                    兼容 OpenAI Chat Completions 协议。保存后立即生效，无需重启服务。
                  </CardDescription>
                </div>
                <SourceBadge source={settings.ai.source} />
              </div>
            </CardHeader>
            <CardBody>
              <form className="space-y-4" onSubmit={saveAi}>
                <Toggle
                  id="ai-enabled"
                  checked={aiForm.enabled}
                  onChange={(enabled) => setAiForm((form) => ({ ...form, enabled }))}
                  label="启用 AI 学习助手"
                  description="关闭后，题目详情页的 AI 问答入口将不可用。"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Base URL"
                    placeholder="https://api.example.com/v1"
                    value={aiForm.baseUrl}
                    onChange={(event) => setAiForm((form) => ({ ...form, baseUrl: event.target.value }))}
                  />
                  <Input
                    label="模型名称"
                    placeholder="gpt-4o-mini"
                    value={aiForm.model}
                    onChange={(event) => setAiForm((form) => ({ ...form, model: event.target.value }))}
                  />
                  <Input
                    containerClassName="sm:col-span-2"
                    label="API Key"
                    type="password"
                    autoComplete="new-password"
                    placeholder={settings.ai.hasApiKey ? '已保存，留空保持不变' : '请输入 API Key'}
                    helperText={settings.ai.hasApiKey ? '出于安全考虑不回显，填写新值才会覆盖。' : undefined}
                    value={aiForm.apiKey}
                    onChange={(event) => setAiForm((form) => ({ ...form, apiKey: event.target.value }))}
                  />
                </div>

                <FeedbackMessage feedback={aiFeedback} />

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" loading={savingAi} icon={<Save className="h-4 w-4" />}>
                    保存 AI 设置
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    loading={testingAi}
                    icon={<PlugZap className="h-4 w-4" />}
                    onClick={testAi}
                  >
                    测试连接
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    loading={resetting === 'ai'}
                    icon={<RotateCcw className="h-4 w-4" />}
                    onClick={() => resetSection('ai')}
                  >
                    恢复 .env 配置
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card hover={false}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-amber-500" />
              部署信息
            </CardTitle>
            <CardDescription>来自后端公开接口 /api/meta，不包含任何凭据</CardDescription>
          </CardHeader>
          <CardBody>
            {loading ? (
              <p className="text-sm text-secondary-500 dark:text-secondary-400">正在读取部署信息…</p>
            ) : !meta ? (
              <p className="text-sm text-rose-600 dark:text-rose-400">
                无法读取部署信息，请确认后端服务与 /api/meta 可访问。
              </p>
            ) : (
              <div>
                <InfoRow label="应用版本">v{meta.version}</InfoRow>
                <InfoRow label="数据库">{meta.database}</InfoRow>
                <InfoRow label="访问地址">{window.location.origin}</InfoRow>
                <InfoRow label="代码许可证">
                  <MetaLink href={PROJECT_LINKS.license}>{meta.license}</MetaLink>
                </InfoRow>
                <InfoRow label="题库数据许可">
                  <MetaLink href={PROJECT_LINKS.dataLicense}>{meta.dataLicense}</MetaLink>
                </InfoRow>
              </div>
            )}
          </CardBody>
        </Card>

        <Card hover={false}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              功能状态
            </CardTitle>
            <CardDescription>根据当前 SMTP 与 AI 配置实时计算</CardDescription>
          </CardHeader>
          <CardBody>
            {loading ? (
              <p className="text-sm text-secondary-500 dark:text-secondary-400">正在读取功能状态…</p>
            ) : !meta ? (
              <p className="text-sm text-secondary-500 dark:text-secondary-400">状态未知</p>
            ) : (
              <div>
                <InfoRow label="自助注册">
                  <span
                    className={
                      meta.registrationEnabled
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-secondary-500 dark:text-secondary-400'
                    }
                  >
                    {meta.registrationEnabled ? '已启用（SMTP 已配置）' : '未启用（SMTP 未配置）'}
                  </span>
                </InfoRow>
                <InfoRow label="AI 功能">
                  <span
                    className={
                      meta.aiEnabled
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-secondary-500 dark:text-secondary-400'
                    }
                  >
                    {meta.aiEnabled ? '已启用' : '未启用'}
                  </span>
                </InfoRow>
                <InfoRow label="账户角色">学生 / 教师 / 管理员</InfoRow>
                <InfoRow label="会话方式">JWT（改密后旧会话失效）</InfoRow>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card hover={false}>
        <CardHeader>
          <CardTitle>项目与支持</CardTitle>
          <CardDescription>文档、反馈渠道与版本记录</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projectDocs.map((doc) => {
              const Icon = doc.icon
              return (
                <a
                  key={doc.label}
                  href={doc.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl border border-secondary-200 dark:border-secondary-800 text-sm text-secondary-700 dark:text-secondary-300 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-secondary-50 dark:hover:bg-secondary-800/50 transition-colors"
                >
                  <Icon className="h-4 w-4 text-secondary-500 dark:text-secondary-400 flex-shrink-0" />
                  <span className="flex-1">{doc.label}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-secondary-400" />
                </a>
              )
            })}
          </div>
          <p className="mt-4 text-xs text-secondary-400 dark:text-secondary-500">
            敏感信息（SMTP 密码、AI API Key）加密后保存在数据库中，不会通过接口回显。若修改了
            <code className="mx-1 text-secondary-600 dark:text-secondary-300">JWT_SECRET</code>
            ，需要重新填写上述凭据。
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
