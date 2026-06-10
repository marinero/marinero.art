'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Upload, Music, X, Loader2 } from 'lucide-react'
import type { MultitrackGroup } from '@/lib/types'

import { audioStreamUrl } from '@/lib/storage-keys'

const CHUNK_SIZE = 2 * 1024 * 1024 // 2MB chunks

async function uploadInChunks(
  file: File,
  filename: string,
  onProgress: (percent: number) => void
): Promise<string> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`

  let finalPathname = ''

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    const params = new URLSearchParams({
      uploadId,
      chunkIndex: i.toString(),
      totalChunks: totalChunks.toString(),
      filename,
    })

    const response = await fetch(`/api/upload/multitrack-chunk?${params}`, {
      method: 'POST',
      body: chunk,
      credentials: 'include',
      headers: {
        'Content-Type': file.type || 'audio/mpeg',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(error.error || 'Upload failed')
    }

    const result = await response.json()

    if (result.complete && result.pathname) {
      finalPathname = result.pathname
    }

    onProgress(Math.round(((i + 1) / totalChunks) * 100))
  }

  if (!finalPathname) {
    throw new Error('Upload completed but no pathname returned')
  }

  return audioStreamUrl(finalPathname)
}

interface MultitrackUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rehearsalId: string
  onUploadComplete: (group: MultitrackGroup) => void
}

interface FileWithProgress {
  file: File
  progress: number
  waveform?: number[]
  duration?: number
  url?: string
  error?: string
}

// Generate waveform data from audio file
async function generateWaveform(file: File, numBars: number = 400): Promise<{ waveform: number[]; duration: number }> {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        const channelData = audioBuffer.getChannelData(0)
        const samples = channelData.length
        const samplesPerBar = Math.floor(samples / numBars)
        const waveform: number[] = []

        for (let i = 0; i < numBars; i++) {
          const start = i * samplesPerBar
          const end = start + samplesPerBar
          let sum = 0

          for (let j = start; j < end; j++) {
            sum += Math.abs(channelData[j])
          }

          const average = sum / samplesPerBar
          waveform.push(Math.min(1, average * 2))
        }

        const maxAmplitude = Math.max(...waveform)
        const normalizedWaveform = waveform.map(v => v / maxAmplitude)

        audioContext.close()
        resolve({ waveform: normalizedWaveform, duration: audioBuffer.duration })
      } catch (error) {
        audioContext.close()
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

// Sanitize filename for upload
function sanitizeFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  const ext = lastDot !== -1 ? filename.slice(lastDot) : ''
  const name = lastDot !== -1 ? filename.slice(0, lastDot) : filename
  
  const sanitized = name
    .replace(/[а-яА-ЯёЁ]/g, (char) => {
      const map: Record<string, string> = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
        'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
        'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
        'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch',
        'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
      }
      return map[char] || char
    })
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  
  return sanitized + ext
}

// Имя группы по умолчанию, если пользователь не ввёл своё.
function generateDefaultGroupName(files: FileWithProgress[]): string {
  const firstName = files[0]?.file.name.replace(/\.[^/.]+$/, '').trim()
  if (firstName) return firstName
  return new Date().toISOString().slice(0, 10)
}

export function MultitrackUploadDialog({
  open,
  onOpenChange,
  rehearsalId,
  onUploadComplete
}: MultitrackUploadDialogProps) {
  const [groupName, setGroupName] = useState('')
  const [files, setFiles] = useState<FileWithProgress[]>([])
  const [uploading, setUploading] = useState(false)
  const [processingWaveforms, setProcessingWaveforms] = useState(false)
  const [currentStep, setCurrentStep] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || [])
    const audioFiles = selectedFiles.filter(f => 
      f.type.startsWith('audio/') || 
      f.name.endsWith('.mp3') || 
      f.name.endsWith('.wav') ||
      f.name.endsWith('.flac') ||
      f.name.endsWith('.ogg')
    )

    const newFiles = audioFiles.map(file => ({ file, progress: 0 }))
    setFiles(prev => [...prev, ...newFiles])

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    if (audioFiles.length > 0) {
      setProcessingWaveforms(true)
      setCurrentStep('Генерация waveforms...')
      
      for (let i = 0; i < audioFiles.length; i++) {
        try {
          setCurrentStep(`Обработка ${i + 1}/${audioFiles.length}: ${audioFiles[i].name}`)
          const { waveform, duration } = await generateWaveform(audioFiles[i])
          setFiles(prev => prev.map(f => 
            f.file.name === audioFiles[i].name && !f.waveform
              ? { ...f, waveform, duration: Math.round(duration) }
              : f
          ))
        } catch (error) {
          console.error(`Failed to generate waveform for ${audioFiles[i].name}:`, error)
          setFiles(prev => prev.map(f => 
            f.file.name === audioFiles[i].name && !f.waveform
              ? { ...f, error: 'Ошибка обработки' }
              : f
          ))
        }
      }
      
      setProcessingWaveforms(false)
      setCurrentStep('')
    }
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    if (files.length === 0) return

    const finalGroupName = groupName.trim() || generateDefaultGroupName(files)

    setUploading(true)
    setCurrentStep('Начинаем загрузку...')

    const uploadedFiles: { filename: string; file_url: string; duration_seconds?: number; waveform_data?: number[] }[] = []

    for (let i = 0; i < files.length; i++) {
      const fileWithProgress = files[i]
      if (fileWithProgress.error) continue

      try {
        setCurrentStep(`Загрузка ${i + 1}/${files.length}: ${fileWithProgress.file.name}`)
        const sanitizedName = sanitizeFilename(fileWithProgress.file.name)
        const blobPath = `multitrack/${Date.now()}-${sanitizedName}`
        
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, progress: 5 } : f
        ))

        // Upload in chunks to bypass Vercel body size limit
        const url = await uploadInChunks(
          fileWithProgress.file,
          blobPath,
          (percent) => {
            setFiles(prev => prev.map((f, idx) => 
              idx === i ? { ...f, progress: percent } : f
            ))
          }
        )

        uploadedFiles.push({
          filename: fileWithProgress.file.name,
          file_url: url,
          duration_seconds: fileWithProgress.duration,
          waveform_data: fileWithProgress.waveform
        })

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, url, progress: 100 } : f
        ))
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка'
        console.error(`Failed to upload ${fileWithProgress.file.name}:`, error)
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, error: `Ошибка: ${errorMsg}` } : f
        ))
      }
    }

    if (uploadedFiles.length > 0) {
      try {
        setCurrentStep('Сохранение в базу данных...')
        
        const response = await fetch('/api/multitrack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rehearsal_id: rehearsalId,
            name: finalGroupName,
            files: uploadedFiles
          })
        })

        if (response.ok) {
          const group = await response.json()
          onUploadComplete(group)
          handleClose()
        } else {
          const data = await response.json()
          setCurrentStep(`Ошибка: ${data.error}`)
        }
      } catch (error) {
        console.error('Failed to create multitrack group:', error)
        setCurrentStep('Ошибка сохранения')
      }
    } else {
      setCurrentStep('Нет успешно загруженных файлов')
    }

    setUploading(false)
  }

  function handleClose() {
    setGroupName('')
    setFiles([])
    setCurrentStep('')
    onOpenChange(false)
  }

  const canUpload = files.length > 0 && !uploading && !processingWaveforms && files.every(f => f.waveform || f.error)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-indigo-600" />
            Загрузить мультитрек
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">
              Название группы треков{' '}
              <span className="text-muted-foreground font-normal">(необязательно)</span>
            </Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Например: 2024-08-14 - НЗБ-ПЛБ"
            />
          </div>

          <div className="space-y-2">
            <Label>Аудиофайлы</Label>
            <div 
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Нажмите для выбора файлов или перетащите сюда
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                MP3, WAV, FLAC, OGG (до 200 МБ каждый)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.flac,.ogg"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {files.map((fileWithProgress, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg"
                >
                  <Music className="h-4 w-4 text-indigo-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {fileWithProgress.file.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {(fileWithProgress.file.size / 1024 / 1024).toFixed(1)} МБ
                        {fileWithProgress.duration && ` · ${Math.floor(fileWithProgress.duration / 60)}:${(fileWithProgress.duration % 60).toString().padStart(2, '0')}`}
                      </p>
                      {fileWithProgress.waveform && (
                        <span className="text-xs text-green-600">Waveform готов</span>
                      )}
                      {fileWithProgress.url && (
                        <span className="text-xs text-blue-600">Файл загружен</span>
                      )}
                      {fileWithProgress.error && (
                        <span className="text-xs text-destructive">{fileWithProgress.error}</span>
                      )}
                    </div>
                    {(uploading || processingWaveforms) && fileWithProgress.progress > 0 && fileWithProgress.progress < 100 && (
                      <Progress value={fileWithProgress.progress} className="h-1 mt-1" />
                    )}
                  </div>
                  {!uploading && !processingWaveforms && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {currentStep && (
            <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              <p className="text-sm text-indigo-700 dark:text-indigo-300">{currentStep}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Отмена
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!canUpload}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Загрузка...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Загрузить {files.length} {files.length === 1 ? 'файл' : files.length < 5 ? 'файла' : 'файлов'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
