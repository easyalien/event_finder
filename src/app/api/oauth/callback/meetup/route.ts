import { NextRequest, NextResponse } from 'next/server'
import { oauthManager } from '@/services/oauth/oauthManager'
import { MeetupOAuthProvider } from '@/services/oauth/providers/meetupOAuth'

// Register the provider
oauthManager.registerProvider(new MeetupOAuthProvider())

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    console.error('Meetup OAuth error:', error)
    return NextResponse.redirect(
      new URL(`/oauth/error?provider=meetup&error=${encodeURIComponent(error)}`, request.url)
    )
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/oauth/error?provider=meetup&error=missing_parameters', request.url)
    )
  }

  try {
    const result = await oauthManager.handleCallback('meetup', code, state)
    
    if (result.success) {
      // Redirect to the original path or events page
      const redirectPath = result.redirectPath || '/events'
      return NextResponse.redirect(new URL(redirectPath, request.url))
    } else {
      return NextResponse.redirect(
        new URL(`/oauth/error?provider=meetup&error=${encodeURIComponent(result.error || 'unknown')}`, request.url)
      )
    }
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/oauth/error?provider=meetup&error=callback_failed', request.url)
    )
  }
}