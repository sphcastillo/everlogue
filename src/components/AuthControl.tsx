import Link from 'next/link'
import {AccountMenu} from './AccountMenu'

export function AuthControl({avatarSrc, signedIn}: {avatarSrc?: string | null; signedIn: boolean}) {
  return (
    <div className="flex items-center">
      {signedIn ? (
        <AccountMenu avatarSrc={avatarSrc} />
      ) : (
        <Link href="/sign-in" className="text-[0.7rem] font-medium tracking-[0.14em] text-muted uppercase hover:text-ink">
          Sign in
        </Link>
      )}
    </div>
  )
}
