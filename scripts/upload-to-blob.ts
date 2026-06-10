import { put } from '@vercel/blob'
import { readFileSync } from 'fs'
import { join } from 'path'

const images = [
  { file: 'marinero_logo.png', name: 'marinero-logo.png' },
  { file: 'hero_bg.jpg', name: 'hero-bg.jpg' },
  { file: 'gallery_1.jpg', name: 'gallery-1.jpg' },
  { file: 'gallery_2.jpg', name: 'gallery-2.jpg' },
  { file: 'gallery_3.jpg', name: 'gallery-3.jpg' },
  { file: 'gallery_4.jpg', name: 'gallery-4.jpg' },
]

async function uploadImages() {
  const results: Record<string, string> = {}
  
  for (const img of images) {
    const filePath = join(process.cwd(), 'temp_images', img.file)
    const fileBuffer = readFileSync(filePath)
    
    console.log(`Uploading ${img.name}...`)
    
    const blob = await put(`marinero/${img.name}`, fileBuffer, {
      access: 'public',
    })
    
    results[img.name] = blob.url
    console.log(`  -> ${blob.url}`)
  }
  
  console.log('\n\nAll URLs:')
  console.log(JSON.stringify(results, null, 2))
}

uploadImages().catch(console.error)
