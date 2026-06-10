import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''

    if (!email || !password || !displayName) {
      return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Пароль должен быть не короче 6 символов' }, { status: 400 })
    }

    const existing = await db.queryOne<{ id: string }>(
      'SELECT id FROM users WHERE lower(email) = $1',
      [email]
    )

    if (existing) {
      return NextResponse.json({ error: 'Email уже зарегистрирован' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await db.queryOne<{ id: string }>(
      `INSERT INTO users (email, password_hash, email_verified)
       VALUES ($1, $2, true)
       RETURNING id`,
      [email, passwordHash]
    )

    if (!user) {
      return NextResponse.json({ error: 'Не удалось создать пользователя' }, { status: 500 })
    }

    await db.query(
      `INSERT INTO profiles (id, display_name, role)
       VALUES ($1, $2, 'fan')`,
      [user.id, displayName]
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
