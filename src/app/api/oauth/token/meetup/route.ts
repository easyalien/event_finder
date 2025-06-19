import { NextRequest, NextResponse } from 'next/server'

const MEETUP_CLIENT_ID = process.env.NEXT_PUBLIC_MEETUP_CLIENT_ID
const MEETUP_CLIENT_SECRET = process.env.MEETUP_CLIENT_SECRET

export async function POST(request: NextRequest) {
  if (!MEETUP_CLIENT_ID || !MEETUP_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Meetup OAuth credentials not configured' },
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
    const tokenResponse = await fetch('https://secure.meetup.com/oauth2/access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_id: MEETUP_CLIENT_ID,
        client_secret: MEETUP_CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Meetup token exchange error:', errorText)
      return NextResponse.json(
        { error: 'Token exchange failed' },
        { status: tokenResponse.status }
      )
    }

    const tokenData = await tokenResponse.json()
    return NextResponse.json(tokenData)

  } catch (error) {
    console.error('Error in Meetup token exchange:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}