import {redirect} from 'next/navigation'
import {auth} from '@clerk/nextjs/server'

export default async function LibrarySettingsPage() {
  await auth.protect()
  redirect('/settings/library/import-export')
}
