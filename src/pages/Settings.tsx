import { useState } from 'react'
import { useAuthStore } from '../stores/auth'
import { Card, CardHeader, CardBody, CardTitle, CardDescription, CardFooter } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export default function Settings() {
  const { user } = useAuthStore()
  const [email, setEmail] = useState(user?.email ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [saving, setSaving] = useState(false)

  const onSave = async () => {
    setSaving(true)
    try {
      await new Promise(r => setTimeout(r, 600))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>账户设置</CardTitle>
          <CardDescription>更新基础账户信息</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <Input label="用户名" value={username} onChange={e => setUsername(e.target.value)} />
            <Input label="邮箱" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </CardBody>
        <CardFooter>
          <Button onClick={onSave} loading={saving}>保存</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>安全设置</CardTitle>
          <CardDescription>密码与登录安全</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <Input label="当前密码" type="password" />
            <Input label="新密码" type="password" />
            <Input label="确认新密码" type="password" />
          </div>
        </CardBody>
        <CardFooter>
          <Button variant="outline">更新密码</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
