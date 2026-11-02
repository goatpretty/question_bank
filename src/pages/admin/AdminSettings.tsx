import { Card, CardHeader, CardBody, CardTitle, CardDescription, CardFooter } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

export default function AdminSettings() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>系统设置</CardTitle>
          <CardDescription>基础平台参数</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary-500">开发模式</span>
              <span className="text-sm">development</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary-500">后端地址</span>
              <span className="text-sm">{`http://${window.location.hostname}:3001`}</span>
            </div>
          </div>
        </CardBody>
        <CardFooter>
          <Button variant="outline">保存</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>主题与外观</CardTitle>
          <CardDescription>界面外观配置</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="text-sm text-secondary-500">使用顶部菜单进行主题切换</div>
        </CardBody>
        <CardFooter>
          <Button>应用更改</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
