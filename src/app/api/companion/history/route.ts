import {NextResponse} from 'next/server'
import {
  deleteCompanionHistory,
  getCompanionHistory,
  hideCompanionRecommendation,
  MAX_COMPANION_HISTORY_MESSAGES,
  MAX_COMPANION_MESSAGE_LENGTH,
  saveCompanionHistory,
  type CompanionHistoryMessage,
} from '@/lib/companion-history'
import {privateHeaders, requireReader} from '@/lib/reader'

export const dynamic = 'force-dynamic'

function isValidMessage(value: unknown): value is CompanionHistoryMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  return (
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.text === 'string' &&
    message.text.trim().length > 0 &&
    message.text.length <= MAX_COMPANION_MESSAGE_LENGTH &&
    (message.createdAt === undefined ||
      (typeof message.createdAt === 'string' &&
        Number.isFinite(Date.parse(message.createdAt))))
  )
}

function errorResponse(error: unknown) {
  if (error instanceof Error && error.message === 'Sign in to continue.') {
    return NextResponse.json(
      {error: error.message},
      {status: 401, headers: privateHeaders()},
    )
  }
  console.error('Unable to update companion history:', error)
  return NextResponse.json(
    {error: 'Unable to update companion history.'},
    {status: 500, headers: privateHeaders()},
  )
}

export async function GET() {
  try {
    const reader = await requireReader()
    const messages = await getCompanionHistory(reader.readerId)
    return NextResponse.json({messages}, {headers: privateHeaders()})
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const reader = await requireReader()
    const body = await request.json()
    if (
      !body ||
      !Array.isArray(body.messages) ||
      body.messages.length > MAX_COMPANION_HISTORY_MESSAGES ||
      !body.messages.every(isValidMessage)
    ) {
      return NextResponse.json(
        {error: 'Invalid companion history.'},
        {status: 400, headers: privateHeaders()},
      )
    }

    await saveCompanionHistory(reader.readerId, body.messages)
    return NextResponse.json({ok: true}, {headers: privateHeaders()})
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE() {
  try {
    const reader = await requireReader()
    await deleteCompanionHistory(reader.readerId)
    return NextResponse.json({ok: true}, {headers: privateHeaders()})
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const reader = await requireReader()
    const body = await request.json()
    const recommendationKey = body?.recommendationKey
    if (
      typeof recommendationKey !== 'string' ||
      recommendationKey.length > 300 ||
      !/^[A-Za-z0-9._:-]+$/.test(recommendationKey)
    ) {
      return NextResponse.json(
        {error: 'Invalid recommendation.'},
        {status: 400, headers: privateHeaders()},
      )
    }
    await hideCompanionRecommendation(reader.readerId, recommendationKey)
    return NextResponse.json({ok: true}, {headers: privateHeaders()})
  } catch (error) {
    return errorResponse(error)
  }
}
