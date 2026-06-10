import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { HeroSection } from '@/components/home/hero-section'
import { PlatformLinksSection } from '@/components/home/platform-links-section'
import { EventsPreview } from '@/components/home/events-preview'
import { GalleryPreview } from '@/components/home/gallery-preview'
import { getSessionUser } from '@/lib/session'

export default async function HomePage() {
  const { user, isAdmin, displayName } = await getSessionUser()

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} isAdmin={isAdmin} displayName={displayName} />
      
      <main className="flex-1">
        <HeroSection />
        <PlatformLinksSection />
        <EventsPreview />
        <GalleryPreview />
      </main>
      
      <Footer />
    </div>
  )
}