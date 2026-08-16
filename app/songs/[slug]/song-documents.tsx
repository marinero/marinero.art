'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileMusic,
  FileText,
  FileImage,
  Download,
  ExternalLink,
  ChevronDown,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SongDocument, SongDocumentKind } from '@/lib/types'

const KIND_LABELS: Record<SongDocumentKind, string> = {
  sheet: 'Ноты',
  tab: 'Табы',
  other: 'Документ',
}

function isImage(doc: SongDocument): boolean {
  return (
    (doc.content_type?.startsWith('image/') ?? false) ||
    /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(doc.filename)
  )
}

function isPdf(doc: SongDocument): boolean {
  return (
    doc.content_type === 'application/pdf' || /\.pdf$/i.test(doc.filename)
  )
}

function DocIcon({ doc }: { doc: SongDocument }) {
  if (isImage(doc)) return <FileImage className="h-5 w-5 text-primary" />
  if (doc.kind === 'sheet') return <FileMusic className="h-5 w-5 text-primary" />
  return <FileText className="h-5 w-5 text-primary" />
}

interface SongDocumentsProps {
  documents: SongDocument[]
  isAdmin: boolean
}

export function SongDocuments({ documents, isAdmin }: SongDocumentsProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileMusic className="h-5 w-5 text-primary" />
          Ноты и табы
          <span className="text-sm font-normal text-muted-foreground">
            ({documents.length})
          </span>
        </h2>

        <div className="space-y-2">
          {documents.map((doc) => {
            const previewable = isImage(doc) || isPdf(doc)
            const isOpen = openId === doc.id

            return (
              <div key={doc.id} className="rounded-lg border overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DocIcon doc={doc} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{doc.title}</span>
                      <Badge variant="secondary" className="text-xs">
                        {KIND_LABELS[doc.kind]}
                      </Badge>
                      {isAdmin && !doc.is_published && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-500/60 text-amber-600 dark:text-amber-500 text-xs"
                        >
                          <EyeOff className="h-3 w-3" />
                          Скрыт
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {previewable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Предпросмотр"
                        onClick={() => setOpenId(isOpen ? null : doc.id)}
                      >
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition-transform',
                            isOpen && 'rotate-180'
                          )}
                        />
                      </Button>
                    )}
                    <a
                      href={`/api/documents/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Открыть">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                    <a href={`/api/documents/${doc.id}?download=1`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Скачать">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>

                {previewable && isOpen && (
                  <div className="border-t bg-muted/30 p-2">
                    {isImage(doc) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/documents/${doc.id}`}
                        alt={doc.title}
                        className="max-h-[80vh] w-auto mx-auto rounded"
                      />
                    ) : (
                      <iframe
                        src={`/api/documents/${doc.id}`}
                        title={doc.title}
                        className="w-full h-[80vh] rounded bg-white"
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
