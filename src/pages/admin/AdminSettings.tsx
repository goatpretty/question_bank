import { useEffect, useState } from 'react'
import { Card, CardHeader, CardBody, CardTitle, CardDescription } from '../../components/ui/Card'
import { metaService, type DeploymentMeta } from '../../services/metaService'
import { PROJECT_LINKS } from '../../config/projectLinks'
import {
  Server,
  ShieldCheck,
  Github,
  ExternalLink,
  BookOpen,
  ScrollText,
  LifeBuoy,
} from 'lucide-react'

const projectDocs = [
  { label: 'GitHub 仓库', href: PROJECT_LINKS.repository, icon: Github },
  { label: 'README / 部署说明', href: PROJECT_LINKS.readme, icon: BookOpen },
  { label: '问题反馈（Issues）', href: PROJECT_LINKS.issues, icon: LifeBuoy },
  { label: '安全政策（SECURITY.md）', href: PROJECT_LINKS.security, icon: ShieldCheck },
  { label: '贡献指南（CONTRIBUTING.md）', href: PROJECT_LINKS.contributing, icon: ScrollText },
  { label: '版本记录（CHANGELOG.md）', href: PROJECT_LINKS.changelog, icon: ScrollText },
]

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

export default function AdminSettings() {
  const [meta, setMeta] = useState<DeploymentMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    metaService
      .getMeta()
      .then((response) => {
        if (!active) return
        setMeta(response.data ?? null)
        setFailed(!response.data)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-6">
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
            ) : failed || !meta ? (
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
            <CardDescription>由服务器环境变量决定，修改后需重启服务</CardDescription>
          </CardHeader>
          <CardBody>
            {loading ? (
              <p className="text-sm text-secondary-500 dark:text-secondary-400">正在读取功能状态…</p>
            ) : failed || !meta ? (
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
            本页只展示运行状态，不提供在线修改配置的功能。注册、AI 与服务端参数请通过
            <code className="mx-1 text-secondary-600 dark:text-secondary-300">.env</code>
            配置并重启服务。
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
