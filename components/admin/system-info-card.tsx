import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Server } from 'lucide-react'
import { getSystemInfo } from '@/lib/system-info'
import { SystemInfoContent } from '@/components/admin/system-info-content'

export async function SystemInfoCard() {
  const info = await getSystemInfo()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          Версия и окружение
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SystemInfoContent info={info} />
      </CardContent>
    </Card>
  )
}
