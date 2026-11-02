import { Card, CardHeader, CardBody, CardTitle, CardDescription } from '../components/ui/Card'

export default function Settings() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>账户设置</CardTitle>
          <CardDescription>更新基础账户信息</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-4xl mb-4">🚧</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">功能建设中</h3>
            <p className="text-gray-500">该功能目前正在开发中，敬请期待。</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>安全设置</CardTitle>
          <CardDescription>密码与登录安全</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-4xl mb-4">🚧</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">功能建设中</h3>
            <p className="text-gray-500">该功能目前正在开发中，敬请期待。</p>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
