import { useEffect, useState } from 'react'
import { Card, CardHeader, CardBody, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useAuthStore } from '../../stores/auth'

const API_HOST = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3001`

interface AdminUser {
  id: string
  username: string
  email: string
  role: 'student' | 'teacher' | 'admin'
  createdAt: string
  updatedAt: string
}

export default function AdminUsers() {
  const { token, user, isAuthenticated } = useAuthStore()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [resetTargetId, setResetTargetId] = useState<string>('')
  const [newPwd, setNewPwd] = useState<string>('')
  const [resetOpen, setResetOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    const fetchUsers = async () => {
      try {
        if (!token || !isAuthenticated || user?.role !== 'admin') {
          return
        }
        const resp = await fetch(`${API_HOST}/api/auth/users`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await resp.json()
        if (mounted && resp.ok && data?.success) {
          setUsers(data.data?.users ?? [])
          setError('')
        } else if (mounted) {
          setError(data?.error || '获取用户数据失败')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchUsers()
    return () => { mounted = false }
  }, [token, isAuthenticated, user?.role])

  const resetPassword = async () => {
    if (!resetTargetId) return
    setSaving(true)
    try {
      const body = newPwd.trim().length >= 6 ? { newPassword: newPwd.trim() } : {}
      const resp = await fetch(`${API_HOST}/api/auth/users/${resetTargetId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify(body)
      })
      if (resp.ok) {
        setResetOpen(false)
        setNewPwd('')
        setResetTargetId('')
      } else {
        const data = await resp.json().catch(() => ({}))
        setError(data?.error || '重置失败')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>用户管理</CardTitle>
        <CardDescription>查看用户数据与重置密码</CardDescription>
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
              <div className="text-sm text-secondary-500">不输入则默认重置为 123456</div>
            </div>
            <div className="mb-6">
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="form-input"
                placeholder="输入新密码（至少6位）"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setResetOpen(false); setNewPwd(''); setResetTargetId(''); }}>取消</Button>
              <Button onClick={resetPassword} loading={saving}>确认重置</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
