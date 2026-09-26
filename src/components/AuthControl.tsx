import {Show, SignInButton} from '@clerk/nextjs'
import {AccountMenu} from './AccountMenu'

export function AuthControl() {
  return (
    <div className="flex items-center">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="text-[0.7rem] font-medium tracking-[0.14em] text-muted uppercase hover:text-ink">
            Sign in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <AccountMenu />
      </Show>
    </div>
  )
}
