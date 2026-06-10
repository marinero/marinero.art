'use client'

import { useState } from 'react'
import { Server } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SystemInfo } from '@/lib/system-info'
import {
  SystemInfoContent,
  deploymentBannerClass,
  deploymentShortLabel,
} from '@/components/admin/system-info-content'

export function EnvironmentIndicator({ info }: { info: SystemInfo }) {
  const [open, setOpen] = useState(false)
  const { deployment } = info
  const shortLabel = deploymentShortLabel(deployment.kind)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`absolute top-4 right-4 z-10 lg:top-8 lg:right-8 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors hover:opacity-90 ${deploymentBannerClass[deployment.kind]}`}
        title={deployment.label}
      >
        <Server className="h-3.5 w-3.5 shrink-0" />
        <span>{shortLabel}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Версия и окружение
            </DialogTitle>
          </DialogHeader>
          <SystemInfoContent info={info} />
        </DialogContent>
      </Dialog>
    </>
  )
}
