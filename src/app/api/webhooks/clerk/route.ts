import {NextRequest, NextResponse} from 'next/server'
import {clerkClient} from '@clerk/nextjs/server'
import {verifyWebhook} from '@clerk/nextjs/webhooks'
import {writeClient} from '@/sanity/client'
import {identityGuardId, syncReaderProfile} from '@/lib/reader-profile'

export async function POST(req: NextRequest) {
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET || process.env.CLERK_WEBHOOK_SECRET
  if (!signingSecret) {
    return NextResponse.json({error: 'CLERK_WEBHOOK_SIGNING_SECRET is not configured'}, {status: 503})
  }

  let event
  try {
    event = await verifyWebhook(req, {signingSecret})
  } catch {
    return NextResponse.json({error: 'Invalid webhook signature'}, {status: 400})
  }

  try {
    if (event.type === 'user.created' || event.type === 'user.updated') {
      // Read current identity so a delayed event cannot restore outdated names.
      const clerk = await clerkClient()
      let user
      try {
        user = await clerk.users.getUser(event.data.id)
      } catch (error) {
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
          return NextResponse.json({ok: true}) // Account was deleted before delivery.
        }
        throw error
      }
      await syncReaderProfile(writeClient(), user)
    }
    if (event.type === 'user.deleted' && event.data.id) {
      const clerkUserId = event.data.id
      const client = writeClient()
      const profiles = await client.fetch<{_id: string}[]>(
        `*[_type == "readerProfile" && clerkUserId == $clerkUserId]{_id}`,
        {clerkUserId},
        {cache: 'no-store'},
      )
      // Delete related documents together so references between shelves and
      // entries cannot cause a partially completed account deletion.
      const transaction = client.transaction()
      for (const profile of profiles) {
        const related = await client.fetch<{_id: string}[]>(
          `*[references($id) && _type in ["rating","review","shelf","shelfEntry","readingProgress","companionConversation","clubMembership","vote","discussionPost"]]{_id}`,
          {id: profile._id},
          {cache: 'no-store'},
        )
        for (const doc of related) transaction.delete(doc._id)
        transaction.delete(profile._id)
      }
      transaction.delete(identityGuardId(clerkUserId))
      await transaction.commit()
    }
    return NextResponse.json({ok: true})
  } catch (error) {
    console.error('Clerk reader profile sync failed:', error)
    return NextResponse.json({error: 'Reader profile sync failed'}, {status: 500})
  }
}
