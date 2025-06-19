import { NextRequest, NextResponse } from 'next/server'

const EVENTBRITE_API_TOKEN = process.env.NEXT_PUBLIC_EVENTBRITE_API_TOKEN

export async function GET(request: NextRequest) {
  if (!EVENTBRITE_API_TOKEN) {
    return NextResponse.json(
      { error: 'Eventbrite API token is not configured' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  
  const q = searchParams.get('q') // venue name
  const address = searchParams.get('location.address')
  const within = searchParams.get('location.within') || '5mi'

  if (!q) {
    return NextResponse.json(
      { error: 'Venue name (q) is required' },
      { status: 400 }
    )
  }

  const eventbriteParams = new URLSearchParams({
    q,
    'location.within': within
  })

  if (address) {
    eventbriteParams.append('location.address', address)
  }

  try {
    const response = await fetch(
      `https://www.eventbriteapi.com/v3/venues/search/?${eventbriteParams}`,
      {
        headers: {
          'Authorization': `Bearer ${EVENTBRITE_API_TOKEN}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('Eventbrite venue search error:', response.status, response.statusText)
      return NextResponse.json(
        { error: `Eventbrite API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching venues from Eventbrite:', error)
    return NextResponse.json(
      { error: 'Failed to search venues' },
      { status: 500 }
    )
  }
}