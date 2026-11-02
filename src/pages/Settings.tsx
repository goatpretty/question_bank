import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, CardBody, CardTitle, CardDescription } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { UserAvatar } from '../components/UserAvatar'
import { AvatarCropper } from '../components/AvatarCropper'
import { useAuthStore } from '../stores/auth'
import { userService } from '../services/userService'
import { accountService } from '../services/accountService'
import { cn } from '../lib/utils'
import {
  AtSign,
  Camera,
  KeyRound,
  Loader2,
  ShieldCheck,
  Target,
  Trash2,
  UserRound,
} from 'lucide-react'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']

interface ProfileStats {
  totalWrongQuestions: number
  masteredWrongQuestions: number
  masteryRate: number
}

interface Feedback {
  type: 'success' | 'error'
  text: string
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

function roleLabel(role?: string): string {
  if (role === 'admin') return '管理员'
  if (role === 'teacher') return '教师'
  return '学生'
}

export default function Settings() {
  const { user, token, updateUser, updateSession } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback | null>(null)

  const [cropFile, setCropFile] = useState<File | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarFeedback, setAvatarFeedback] = useState<Feedback | null>(null)

  useEffect(() => {
    let active = true
    setStatsLoading(true)

    userService.getProfile()
      .then((response) => {
        if (active && response.success) {
          setStats(response.data?.stats ?? null)
        }
      })
      .catch(() => {
        if (active) setStats(null)
      })
      .finally(() => {
        if (active) setStatsLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setPasswordFeedback(null)

    if (!currentPassword) {
      setPasswordFeedback({ type: 'error', text: '请输入当前密码。' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', text: '新密码长度至少为 8 位。' })
      return
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordFeedback({ type: 'error', text: '新密码必须同时包含字母和数字。' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', text: '两次输入的新密码不一致。' })
      return
    }
    if (newPassword === currentPassword) {
      setPasswordFeedback({ type: 'error', text: '新密码不能与当前密码相同。' })
      return
    }

    setPasswordSaving(true)
    try {
      const response = await accountService.changePassword(currentPassword, newPassword)
      if (response.token && response.user) {
        updateSession(response.token, response.user)
      } else if (response.user) {
        updateUser(response.user)
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordFeedback({ type: 'success', text: response.message || '密码更新成功。' })
    } catch (error) {
      setPasswordFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : '修改密码失败。',
      })
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleAvatarSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setAvatarFeedback(null)
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarFeedback({ type: 'error', text: '仅支持 JPG、PNG 或 WebP 图片。' })
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarFeedback({
        type: 'error',
        text: `图片不能超过 2MB（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）。`,
      })
      return
    }

    setCropFile(file)
  }

  const uploadCroppedAvatar = async (blob: Blob) => {
    setAvatarBusy(true)
    try {
      const response = await accountService.uploadAvatar(blob)
      if (response.data?.user) updateUser(response.data.user)
      setCropFile(null)
      setAvatarFeedback({ type: 'success', text: response.message || '头像已更新。' })
    } catch (error) {
      const message = error instanceof Error ? error.message : '头像上传失败。'
      setAvatarFeedback({ type: 'error', text: message })
      throw error
    } finally {
      setAvatarBusy(false)
    }
  }

  const removeAvatar = async () => {
    if (!window.confirm('确定要移除当前头像吗？')) return

    setAvatarFeedback(null)
    setAvatarBusy(true)
    try {
      const response = await accountService.removeAvatar()
      if (response.data?.user) updateUser(response.data.user)
      setAvatarFeedback({ type: 'success', text: response.message || '头像已移除。' })
    } catch (error) {
      setAvatarFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : '移除头像失败。',
      })
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card hover={false}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-amber-500" />
            个人资料
          </CardTitle>
          <CardDescription>头像与账号信息，修改后立即生效</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
            <div className="flex flex-col items-center gap-3 sm:w-40 flex-shrink-0">
              <UserAvatar avatar={user?.avatar} username={user?.username} size="xl" />
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={<Camera className="h-4 w-4" />}
                  loading={avatarBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  更换头像
                </Button>
                {user?.avatar && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="h-4 w-4" />}
                    disabled={avatarBusy}
                    onClick={removeAvatar}
                  >
                    移除
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                data-testid="avatar-input"
                onChange={handleAvatarSelected}
              />
              <p className="text-center text-xs text-secondary-400 dark:text-secondary-500">
                JPG / PNG / WebP，原图不超过 2MB
              </p>
              <FeedbackMessage feedback={avatarFeedback} />
            </div>

            <div className="flex-1 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="用户名"
                  value={user?.username ?? ''}
                  readOnly
                  autoComplete="username"
                  helperText="用户名用于登录，暂不支持修改"
                  className="cursor-not-allowed bg-secondary-100 dark:bg-secondary-800"
                />
                <Input
                  label="邮箱"
                  type="email"
                  value={user?.email ?? ''}
                  readOnly
                  leftIcon={<AtSign className="h-4 w-4" />}
                  helperText="用于登录与邮件通知，暂不支持修改"
                  className="cursor-not-allowed bg-secondary-100 dark:bg-secondary-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-secondary-200 dark:border-secondary-800 p-4">
                <div>
                  <p className="text-xs text-secondary-500 dark:text-secondary-400">账户角色</p>
                  <p className="mt-1 text-sm font-medium text-secondary-900 dark:text-secondary-100">
                    {roleLabel(user?.role)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-secondary-500 dark:text-secondary-400">注册时间</p>
                  <p className="mt-1 text-sm font-medium text-secondary-900 dark:text-secondary-100">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '—'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-secondary-400 dark:text-secondary-500">
                用户名与邮箱暂不支持自助修改，如有需要请联系管理员。
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card hover={false}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              修改密码
            </CardTitle>
            <CardDescription>验证当前密码后直接修改，无需邮箱验证码</CardDescription>
          </CardHeader>
          <CardBody>
            <form className="space-y-4" onSubmit={changePassword}>
              <Input
                label="当前密码"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <Input
                label="新密码"
                type="password"
                autoComplete="new-password"
                helperText="至少 8 位，且同时包含字母和数字"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <Input
                label="确认新密码"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />

              <FeedbackMessage feedback={passwordFeedback} />

              <Button type="submit" loading={passwordSaving} icon={<ShieldCheck className="h-4 w-4" />}>
                更新密码
              </Button>
              <p className="text-xs text-secondary-400 dark:text-secondary-500">
                修改成功后其他设备上的登录状态会立即失效，当前页面会自动续期。
              </p>
            </form>
          </CardBody>
        </Card>

        <Card hover={false}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-500" />
              学习统计
            </CardTitle>
            <CardDescription>错题与掌握情况</CardDescription>
          </CardHeader>
          <CardBody>
            {statsLoading ? (
              <div className="flex items-center gap-2 text-sm text-secondary-500 dark:text-secondary-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在读取统计…
              </div>
            ) : stats ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-secondary-500 dark:text-secondary-400">错题总数</span>
                    <span className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
                      {stats.totalWrongQuestions}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-secondary-500 dark:text-secondary-400">已掌握错题</span>
                    <span className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
                      {stats.masteredWrongQuestions}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-secondary-500 dark:text-secondary-400">掌握率</span>
                    <span className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
                      {Math.round(stats.masteryRate)}%
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    to="/wrongbook"
                    className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                  >
                    查看错题本
                  </Link>
                  <Link
                    to="/record"
                    className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                  >
                    学习记录
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-secondary-500 dark:text-secondary-400">暂无统计数据。</p>
            )}
          </CardBody>
        </Card>
      </div>

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          busy={avatarBusy}
          error={avatarFeedback?.type === 'error' ? avatarFeedback.text : undefined}
          onCancel={() => {
            if (!avatarBusy) setCropFile(null)
          }}
          onConfirm={uploadCroppedAvatar}
        />
      )}
    </div>
  )
}
