import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { parentCommentId, replyContent, contextType, contextId, contextUrl } =
      await request.json()

    if (!parentCommentId || !replyContent || !contextType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const parentComment = await db.queryOne<{ id: string; user_id: string; content: string }>(
      'SELECT id, user_id, content FROM comments WHERE id = $1',
      [parentCommentId]
    )

    if (!parentComment) {
      return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
    }

    if (parentComment.user_id === session.user.id) {
      return NextResponse.json({ success: true, skipped: true, reason: 'self-reply' })
    }

    const parentUser = await db.queryOne<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [parentComment.user_id]
    )

    if (!parentUser?.email) {
      return NextResponse.json({ error: 'Could not find parent comment author email' }, { status: 404 })
    }

    const replierProfile = await db.queryOne<{ display_name: string | null; username: string | null }>(
      'SELECT display_name, username FROM profiles WHERE id = $1',
      [session.user.id]
    )

    const replierName =
      replierProfile?.display_name || replierProfile?.username || 'Пользователь'

    const parentProfile = await db.queryOne<{ display_name: string | null; username: string | null }>(
      'SELECT display_name, username FROM profiles WHERE id = $1',
      [parentComment.user_id]
    )

    const parentName = parentProfile?.display_name || parentProfile?.username || 'там'

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://marinero.ru'
    let redirectUrl = baseUrl

    if (contextType === 'photo' && contextId) {
      const photo = await db.queryOne<{ album_id: string }>(
        'SELECT album_id FROM photos WHERE id = $1',
        [contextId]
      )
      if (photo) {
        const album = await db.queryOne<{ slug: string }>(
          'SELECT slug FROM albums WHERE id = $1',
          [photo.album_id]
        )
        if (album) {
          redirectUrl = `${baseUrl}/gallery/${album.slug}?photo=${contextId}`
        }
      }
    } else if (contextType === 'event' && contextId) {
      const event = await db.queryOne<{ slug: string }>(
        'SELECT slug FROM events WHERE id = $1',
        [contextId]
      )
      if (event) {
        redirectUrl = `${baseUrl}/events/${event.slug}`
      }
    } else if (contextType === 'song' && contextId) {
      const song = await db.queryOne<{ slug: string }>(
        'SELECT slug FROM song_texts WHERE id = $1',
        [contextId]
      )
      if (song) {
        redirectUrl = `${baseUrl}/songs/${song.slug}`
      }
    } else if (contextUrl) {
      redirectUrl = `${baseUrl}${contextUrl}`
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set, skipping email notification')
      return NextResponse.json({ success: true, skipped: true, reason: 'no-api-key' })
    }

    let contextTitle = ''
    if (contextType === 'photo') {
      contextTitle = 'к фотографии'
    } else if (contextType === 'event') {
      const event = await db.queryOne<{ title: string }>(
        'SELECT title FROM events WHERE id = $1',
        [contextId]
      )
      contextTitle = event?.title ? `к событию "${event.title}"` : 'к событию'
    } else if (contextType === 'song') {
      const song = await db.queryOne<{ title: string }>(
        'SELECT title FROM song_texts WHERE id = $1',
        [contextId]
      )
      contextTitle = song?.title ? `к песне "${song.title}"` : 'к песне'
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Marinero <noreply@marinero.ru>',
      to: [parentUser.email],
      subject: `${replierName} ответил(а) на ваш комментарий`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Новый ответ на комментарий</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
                    <tr>
                      <td style="padding-bottom: 30px; text-align-center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #ffffff;">Marinero</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color: #1a1a1a; border-radius: 12px; padding: 30px;">
                        <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
                          Привет${parentName !== 'там' ? `, ${parentName}` : ''}!
                        </h2>
                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #a1a1aa;">
                          <strong style="color: #ffffff;">${replierName}</strong> ответил(а) на ваш комментарий ${contextTitle}:
                        </p>
                        <div style="margin-bottom: 20px; padding: 15px; background-color: #262626; border-radius: 8px; border-left: 3px solid #404040;">
                          <p style="margin: 0 0 5px 0; font-size: 12px; color: #71717a;">Ваш комментарий:</p>
                          <p style="margin: 0; font-size: 14px; color: #d4d4d8;">${parentComment.content}</p>
                        </div>
                        <div style="margin-bottom: 25px; padding: 15px; background-color: #262626; border-radius: 8px; border-left: 3px solid #3b82f6;">
                          <p style="margin: 0 0 5px 0; font-size: 12px; color: #71717a;">Ответ от ${replierName}:</p>
                          <p style="margin: 0; font-size: 14px; color: #ffffff;">${replyContent}</p>
                        </div>
                        <table role="presentation" style="width: 100%;">
                          <tr>
                            <td align="center">
                              <a href="${redirectUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 8px;">
                                Посмотреть ответ
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-top: 30px; text-align: center;">
                        <p style="margin: 0; font-size: 12px; color: #71717a;">
                          Это письмо было отправлено автоматически с сайта Marinero.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    })

    if (emailError) {
      console.error('Error sending email:', emailError)
      return NextResponse.json({ error: 'Failed to send email', details: emailError }, { status: 500 })
    }

    return NextResponse.json({ success: true, emailId: emailData?.id })
  } catch (error) {
    console.error('Error in comment reply notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
