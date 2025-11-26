import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/auth'
import { Card, CardHeader, CardBody, CardTitle, CardDescription } from '../components/ui/Card'
import { User } from '../../shared/types'

const API_HOST = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3001`

export default function Profile() {
  const { user, token } = useAuthStore()
  const [stats, setStats] = useState<{ totalWrongQuestions: number; masteredWrongQuestions: number; masteryRate: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchProfile = async () => {
      try {
        const resp = await fetch(`${API_HOST}/api/users/profile`, {
          headers: { Authorization: `Bearer ${token ?? ''}` }
        })
        const data = await resp.json()
        if (mounted && resp.ok && data?.success) {
          setStats(data.data?.stats ?? null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchProfile()
    return () => { mounted = false }
  }, [token])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>个人资料</CardTitle>
          <CardDescription>账户基础信息</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-secondary-500">用户名</div>
              <div className="text-lg font-semibold">{user?.username}</div>
            </div>
            <div>
              <div className="text-sm text-secondary-500">邮箱</div>
              <div className="text-lg font-semibold">{user?.email}</div>
            </div>
            <div>
              <div className="text-sm text-secondary-500">角色</div>
              <div className="text-lg font-semibold">{user?.role}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>学习统计</CardTitle>
          <CardDescription>错题与掌握情况</CardDescription>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="skeleton h-24" />
          ) : stats ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary-500">错题总数</span>
                <span className="text-lg font-semibold">{stats.totalWrongQuestions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary-500">已掌握错题</span>
                <span className="text-lg font-semibold">{stats.masteredWrongQuestions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary-500">掌握率</span>
                <span className="text-lg font-semibold">{Math.round(stats.masteryRate)}%</span>
              </div>
            </div>
          ) : (
            <div className="text-secondary-500">暂无统计数据</div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
