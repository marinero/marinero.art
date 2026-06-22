import { Resend } from 'resend'
import { db } from '@/lib/db'
import { extractMentionUsernames } from '@/lib/comment-mentions'
import { adminRehearsalUrl } from '@/lib/rehearsal-url'

export type CommentNotificationContext = {
  authorId: string
  content: string
  contextType: string
  contextId?: string | null
  contextUrl?: string
}

export async function buildCommentRedirectUrl(
  contextType: string,
  contextId?: string | null,
  contextUrl?: string
): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://marinero.ru'

  if (contextUrl) {
    return contextUrl.startsWith('http') ? contextUrl : `${baseUrl}${contextUrl}`
  }

  if (!contextId) return baseUrl

  if (contextType === 'photo') {
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
        return `${baseUrl}/gallery/${album.slug}?photo=${contextId}`
      }
    }
  } else if (contextType === 'event') {
    const event = await db.queryOne<{ slug: string }>(
      'SELECT slug FROM events WHERE id = $1',
      [contextId]
    )
    if (event) {
      return `${baseUrl}/events/${event.slug}`
    }
  } else if (contextType === 'song') {
    const song = await db.queryOne<{ slug: string }>(
      'SELECT slug FROM song_texts WHERE id = $1',
      [contextId]
    )
    if (song) {
      return `${baseUrl}/songs/${song.slug}`
    }
  } else if (contextType === 'video') {
    const video = await db.queryOne<{ slug: string }>(
      'SELECT slug FROM videos WHERE id = $1',
      [contextId]
    )
    if (video) {
      return `${baseUrl}/videos/${video.slug}`
    }
  } else if (contextType === 'rehearsal') {
    const rehearsal = await db.queryOne<{ rehearsal_date: string }>(
      'SELECT rehearsal_date FROM rehearsals WHERE id = $1',
      [contextId]
    )
    if (rehearsal) {
      return `${baseUrl}${adminRehearsalUrl(rehearsal.rehearsal_date)}`
    }
  } else if (contextType === 'audio') {
    const audio = await db.queryOne<{ id: string; rehearsal_date: string }>(
      `SELECT af.id, r.rehearsal_date
       FROM audio_files af
       JOIN rehearsals r ON r.id = af.rehearsal_id
       WHERE af.id = $1`,
      [contextId]
    )
    if (audio) {
      return `${baseUrl}${adminRehearsalUrl(audio.rehearsal_date, { audio: audio.id })}`
    }
  }

  return baseUrl
}

export async function buildCommentContextTitle(
  contextType: string,
  contextId?: string | null
): Promise<string> {
  if (contextType === 'photo') {
    return 'к фотографии'
  }
  if (contextType === 'event' && contextId) {
    const event = await db.queryOne<{ title: string }>(
      'SELECT title FROM events WHERE id = $1',
      [contextId]
    )
    return event?.title ? `к событию "${event.title}"` : 'к событию'
  }
  if (contextType === 'song' && contextId) {
    const song = await db.queryOne<{ title: string }>(
      'SELECT title FROM song_texts WHERE id = $1',
      [contextId]
    )
    return song?.title ? `к песне "${song.title}"` : 'к песне'
  }
  if (contextType === 'video' && contextId) {
    const video = await db.queryOne<{ title: string }>(
      'SELECT title FROM videos WHERE id = $1',
      [contextId]
    )
    return video?.title ? `к видео "${video.title}"` : 'к видео'
  }
  if (contextType === 'rehearsal' || contextType === 'audio') {
    return 'к репетиции'
  }
  if (contextType === 'multitrack') {
    return 'к мультитреку'
  }
  return 'к комментарию'
}

async function findMentionedUsers(authorId: string, content: string) {
  const mentionTargets = extractMentionUsernames(content)
  if (mentionTargets.length === 0) return []

  return db.queryMany<{
    id: string
    email: string
    username: string | null
    display_name: string | null
  }>(
    `SELECT DISTINCT p.id, u.email, p.username, p.display_name
     FROM profiles p
     JOIN users u ON u.id = p.id
     WHERE p.id <> $1
       AND EXISTS (
         SELECT 1
         FROM unnest($2::text[]) AS target(name)
         WHERE lower(trim(p.username)) = target.name
            OR lower(trim(p.display_name)) = target.name
       )`,
    [authorId, mentionTargets]
  )
}

export async function sendCommentMentionNotifications(
  context: CommentNotificationContext
): Promise<{ sent: number; skipped?: string }> {
  const { isMentionEmailEnabled } = await import('@/lib/site-settings')

  if (!(await isMentionEmailEnabled())) {
    return { sent: 0, skipped: 'disabled' }
  }

  const mentionedUsers = await findMentionedUsers(context.authorId, context.content)

  if (mentionedUsers.length === 0) {
    return { sent: 0, skipped: 'no-recipients' }
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set, skipping mention email notifications')
    return { sent: 0, skipped: 'no-api-key' }
  }

  const authorProfile = await db.queryOne<{
    display_name: string | null
    username: string | null
  }>('SELECT display_name, username FROM profiles WHERE id = $1', [context.authorId])

  const authorName =
    authorProfile?.display_name?.trim() ||
    authorProfile?.username?.trim() ||
    'Пользователь'

  const redirectUrl = await buildCommentRedirectUrl(
    context.contextType,
    context.contextId,
    context.contextUrl
  )
  const contextTitle = await buildCommentContextTitle(
    context.contextType,
    context.contextId
  )
  const resend = new Resend(process.env.RESEND_API_KEY)

  let sent = 0

  for (const mentionedUser of mentionedUsers) {
    const recipientName =
      mentionedUser.display_name?.trim() ||
      mentionedUser.username?.trim() ||
      'там'

    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Marinero <noreply@marinero.ru>',
      to: [mentionedUser.email],
      subject: `${authorName} упомянул(а) вас в комментарии`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Упоминание в комментарии</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
                    <tr>
                      <td style="padding-bottom: 30px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #ffffff;">Marinero</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color: #1a1a1a; border-radius: 12px; padding: 30px;">
                        <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
                          Привет${recipientName !== 'там' ? `, ${recipientName}` : ''}!
                        </h2>
                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #a1a1aa;">
                          <strong style="color: #ffffff;">${authorName}</strong> упомянул(а) вас в комментарии ${contextTitle}:
                        </p>
                        <div style="margin-bottom: 25px; padding: 15px; background-color: #262626; border-radius: 8px; border-left: 3px solid #3b82f6;">
                          <p style="margin: 0; font-size: 14px; color: #ffffff;">${context.content}</p>
                        </div>
                        <table role="presentation" style="width: 100%;">
                          <tr>
                            <td align="center">
                              <a href="${redirectUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 8px;">
                                Перейти к комментарию
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

    if (error) {
      console.error('Failed to send mention email:', error)
      continue
    }

    sent += 1
  }

  return { sent }
}
