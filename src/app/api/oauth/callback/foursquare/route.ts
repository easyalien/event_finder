import { NextRequest, NextResponse } from 'next/server'
import { oauthManager } from '@/services/oauth/oauthManager'
import { FoursquareOAuthProvider } from '@/services/oauth/providers/foursquareOAuth'

// Register the provider
oauthManager.registerProvider(new FoursquareOAuthProvider())

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle OAuth errors
  if (error) {
    console.error('Foursquare OAuth error:', error)
    return NextResponse.redirect(
      new URL(`/oauth/error?provider=foursquare&error=${encodeURIComponent(error)}`, request.url)
    )
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/oauth/error?provider=foursquare&error=missing_parameters', request.url)
    )
  }

  try {
    const result = await oauthManager.handleCallback('foursquare', code, state)
    
    if (result.success) {
      // Redirect to the original path or events page
      const redirectPath = result.redirectPath || '/events'
      return NextResponse.redirect(new URL(redirectPath, request.url))
    } else {
      return NextResponse.redirect(
        new URL(`/oauth/error?provider=foursquare&error=${encodeURIComponent(result.error || 'unknown')}`, request.url)
      )
    }
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/oauth/error?provider=foursquare&error=callback_failed', request.url)
    )
  }
}