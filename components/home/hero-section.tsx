import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Calendar, Music } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/marinero/hero_bg.jpg"
          alt="MARINERO на сцене"
          fill
          className="object-cover object-[center_25%]"
          priority
        />
        {/* Gradient Overlay - lighter to show more of the photo */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-transparent to-background/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="max-w-3xl mx-auto">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src="/images/marinero/marinero_logo.png"
              alt="MARINERO"
              width={120}
              height={120}
              className="rounded-2xl shadow-2xl shadow-primary/20"
            />
          </div>

          <h1 className="font-[family-name:var(--font-logo)] text-6xl md:text-8xl tracking-widest mb-6">
            <span className="text-primary">MARINERO</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
            Рок-группа с энергией океана и глубиной звука
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/events">
              <Button size="lg" className="gap-2 text-base">
                <Calendar className="h-5 w-5" />
                Ближайшие концерты
              </Button>
            </Link>
            <Link href="/links">
              <Button size="lg" variant="outline" className="gap-2 text-base">
                <Music className="h-5 w-5" />
                Слушать музыку
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-primary rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  )
}
