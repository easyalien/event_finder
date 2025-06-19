import { NextRequest, NextResponse } from 'next/server'

const EVENTBRITE_API_TOKEN = process.env.NEXT_PUBLIC_EVENTBRITE_API_TOKEN

export async function GET(
  request: NextRequest,
  { params }: { params: { venueId: string } }
) {
  if (!EVENTBRITE_API_TOKEN) {
    return NextResponse.json(
      { error: 'Eventbrite API token is not configured' },
      { status: 500 }
    )
  }

  const venueId = params.venueId
  const { searchParams } = new URL(request.url)
  
  const startDateTime = searchParams.get('start_date.range_start')
  const endDateTime = searchParams.get('start_date.range_end')
  const status = searchParams.get('status') || 'live'

  const eventbriteParams = new URLSearchParams({
    status
  })

  if (startDateTime) {
    eventbriteParams.append('start_date.range_start', startDateTime)
  }

  if (endDateTime) {
    eventbriteParams.append('start_date.range_end', endDateTime)
  }

  try {
    const response = await fetch(
      `https://www.eventbriteapi.com/v3/venues/${venueId}/events/?${eventbriteParams}`,
      {
        headers: {
          'Authorization': `Bearer ${EVENTBRITE_API_TOKEN}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('Eventbrite venue events error:', response.status, response.statusText)
      return NextResponse.json(
        { error: `Eventbrite API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching events from Eventbrite venue:', error)
    return NextResponse.json(
      { error: 'Failed to fetch venue events' },
      { status: 500 }
    )
  }
}