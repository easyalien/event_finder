import { NextRequest, NextResponse } from 'next/server'

const FOURSQUARE_CLIENT_ID = process.env.NEXT_PUBLIC_FOURSQUARE_CLIENT_ID
const FOURSQUARE_CLIENT_SECRET = process.env.FOURSQUARE_CLIENT_SECRET

export async function POST(request: NextRequest) {
  if (!FOURSQUARE_CLIENT_ID || !FOURSQUARE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Foursquare OAuth credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const { code, redirectUri } = await request.json()

    if (!code || !redirectUri) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://foursquare.com/oauth2/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_id: FOURSQUARE_CLIENT_ID,
        client_secret: FOURSQUARE_CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Foursquare token exchange error:', errorText)
      return NextResponse.json(
        { error: 'Token exchange failed' },
        { status: tokenResponse.status }
      )
    }

    const tokenData = await tokenResponse.json()
    return NextResponse.json(tokenData)

  } catch (error) {
    console.error('Error in Foursquare token exchange:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}