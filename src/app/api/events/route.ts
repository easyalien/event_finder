import { NextRequest, NextResponse } from 'next/server'

const TICKETMASTER_API_KEY = process.env.NEXT_PUBLIC_TICKETMASTER_API_KEY

export async function GET(request: NextRequest) {
  if (!TICKETMASTER_API_KEY) {
    return NextResponse.json(
      { error: 'Ticketmaster API key is not configured' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  
  const postalCode = searchParams.get('postalCode')
  const radius = searchParams.get('radius')
  const startDateTime = searchParams.get('startDateTime')
  const endDateTime = searchParams.get('endDateTime')
  const size = searchParams.get('size') || '20'
  const page = searchParams.get('page') || '0'

  if (!postalCode || !radius) {
    return NextResponse.json(
      { error: 'postalCode and radius are required' },
      { status: 400 }
    )
  }

  const ticketmasterParams = new URLSearchParams({
    apikey: TICKETMASTER_API_KEY,
    postalCode,
    radius,
    unit: 'miles',
    size,
    page,
    sort: 'date,asc'
  })

  if (startDateTime) {
    ticketmasterParams.append('startDateTime', startDateTime)
  }

  if (endDateTime) {
    ticketmasterParams.append('endDateTime', endDateTime)
  }

  try {
    const response = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events?${ticketmasterParams}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('Ticketmaster API error:', response.status, response.statusText)
      return NextResponse.json(
        { error: `Ticketmaster API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching from Ticketmaster:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}