import { redirect } from 'next/navigation'

export default async function AdminSongEditorRedirect({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (slug === 'new') redirect('/admin/songs')
  redirect(`/songs/${slug}`)
}
