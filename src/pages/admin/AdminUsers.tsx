import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader, CardBody, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useAuthStore } from '../../stores/auth'
import { adminUserService } from '../../services/adminUserService'
import { User } from '../../../shared/types'

interface AdminUser {
  id: string
  username: string
  email: string
  role: 'student' | 'teacher' | 'admin'
  createdAt: string
  updatedAt: string
}

interface CredentialInfo {
  title: string
  username: string
  password: string
}

function mapUser(u: User): AdminUser {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
    updatedAt: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : String(u.updatedAt),
  }
}

export default function AdminUsers() {
  const { token, user, isAuthenticated } = useAuthStore()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [resetTargetId, setResetTargetId] = useState<string>('')
  const [resetOpen, setResetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newUser, setNewUser] = useState<{ username: string; email: string; password: string; role: 'student' | 'teacher' }>({ username: '', email: '', password: '', role: 'student' })
  const [credential, setCredential] = useState<CredentialInfo | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminUserService.getUsers({})
      if (data.success) {
        setUsers(data.data.users.map(mapUser))
        setError('')
      } else {
        setError(data.error || '获取用户列表失败')
      }
    } catch (err: any) {
      console.error('获取用户列表失败:', err)
      setError(err.message || '获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers, token, isAuthenticated, user?.role])

  const createUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newUser.username.trim()) {
      setError('请填写用户名')
      return
    }
    setSaving(true)
    try {
      const data = await adminUserService.createUser({
        username: newUser.username.trim(),
        password: newUser.password,
        role: newUser.role,
        email: newUser.email,
      })
      if (!data?.success) {
        setError(data?.error || '创建用户失败')
        return
      }

      setCreateOpen(false)
      setNewUser({ username: '', email: '', password: '', role: 'student' })
      await fetchUsers()

      if (data.data.temporaryPassword) {
        setCredential({
          title: '用户创建成功',
          username: data.data.username,
          password: data.data.temporaryPassword,
        })
      }
    } catch (err: any) {
      console.error('创建用户失败:', err)
      setError(err.message || '创建用户失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const resetPassword = async () => {
    if (!resetTargetId) return
    setSaving(true)
    try {
      const target = users.find((item) => item.id === resetTargetId)
      const data = await adminUserService.resetUserPassword(resetTargetId)
      if (data?.success) {
        setResetOpen(false)
        setResetTargetId('')
        await fetchUsers()

        if (data.temporaryPassword) {
          setCredential({
            title: '密码重置成功',
            username: target?.username || resetTargetId,
            password: data.temporaryPassword,
          })
        }
      } else {
        setError(data?.error || '重置失败')
      }
    } catch (err: any) {
      console.error('重置密码失败:', err)
      setError(err.message || '重置密码失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>用户管理</CardTitle>
        <CardDescription>查看用户数据与重置密码</CardDescription>
        <div className="mt-2">
          <Button onClick={() => setCreateOpen(true)}>新增用户</Button>
        </div>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="skeleton h-24" />
        ) : error ? (
          <div className="text-error text-sm">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-secondary-200">
                  <th className="py-2 pr-4">用户名</th>
                  <th className="py-2 pr-4">邮箱</th>
                  <th className="py-2 pr-4">角色</th>
                  <th className="py-2 pr-4">创建时间</th>
                  <th className="py-2 pr-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-secondary-100">
                    <td className="py-2 pr-4">{u.username}</td>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4">{u.role}</td>
                    <td className="py-2 pr-4">{new Date(u.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">
                      <Button variant="outline" onClick={() => { setResetTargetId(u.id); setResetOpen(true); }}>重置密码</Button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-secondary-500">暂无用户</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-secondary-900 rounded-xl shadow-strong w-full max-w-md p-6">
            <div className="mb-4">
              <div className="text-lg font-semibold">重置密码</div>
              <div className="text-sm text-secondary-500">
                系统将生成一次性临时密码，用户首次登录后必须立即修改。
              </div>
            </div>
            <div className="mb-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                临时密码只在重置成功后的弹窗中显示一次，请通过安全渠道转交给用户。
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setResetOpen(false); setResetTargetId(''); }}>取消</Button>
              <Button onClick={resetPassword} loading={saving}>确认重置</Button>
            </div>
          </div>
        </div>
      )}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-secondary-900 rounded-xl shadow-strong w-full max-w-md p-6">
            <div className="mb-4">
              <div className="text-lg font-semibold">创建用户</div>
              <div className="text-sm text-secondary-500">教师账号仅能由管理员创建</div>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="form-input"
                placeholder="用户名"
              />
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="form-input"
                placeholder="邮箱"
              />
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="form-input"
                placeholder="密码（留空则自动生成临时密码）"
              />
              <div className="flex gap-3">
                <Button variant={newUser.role === 'student' ? undefined : 'outline'} onClick={() => setNewUser({ ...newUser, role: 'student' })}>学生</Button>
                <Button variant={newUser.role === 'teacher' ? undefined : 'outline'} onClick={() => setNewUser({ ...newUser, role: 'teacher' })}>教师</Button>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => { setCreateOpen(false); setNewUser({ username: '', email: '', password: '', role: 'student' }) }}>取消</Button>
              <Button onClick={createUser} loading={saving}>创建</Button>
            </div>
          </div>
        </div>
      )}
      {credential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-secondary-900 rounded-xl shadow-strong w-full max-w-md p-6">
            <div className="mb-4">
              <div className="text-lg font-semibold">{credential.title}</div>
              <div className="text-sm text-secondary-500">请立即保存临时密码，关闭后将无法再次查看。</div>
            </div>
            <div className="space-y-2 rounded-lg bg-primary-50 p-4 text-sm dark:bg-primary-900/20">
              <p><span className="font-medium">用户名：</span>{credential.username}</p>
              <p>
                <span className="font-medium">临时密码：</span>
                <code className="rounded bg-white px-2 py-1 font-mono dark:bg-gray-800">{credential.password}</code>
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setCredential(null)}>我已保存</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
