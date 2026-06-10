import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Copyright */}
          <div className="flex items-center gap-3">
            <Image
              src="/images/marinero/marinero_logo.png"
              alt="MARINERO"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-sm text-muted-foreground">
              {new Date().getFullYear()} MARINERO. Все права защищены.
            </span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6">
            <Link
              href="/events"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Концерты
            </Link>
            <Link
              href="/gallery"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Фото
            </Link>
            <Link
              href="/links"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Слушать
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
