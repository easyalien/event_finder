import { NextRequest, NextResponse } from 'next/server'
import { eventService } from '@/services/eventService'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const postalCode = searchParams.get('postalCode')
  const radius = searchParams.get('radius')
  const startDateTime = searchParams.get('startDateTime')
  const endDateTime = searchParams.get('endDateTime')
  const category = searchParams.get('category')

  if (!postalCode || !radius) {
    return NextResponse.json(
      { error: 'postalCode and radius are required' },
      { status: 400 }
    )
  }

  try {
    const searchParams = {
      postalCode,
      radius: parseInt(radius),
      startDateTime: startDateTime || undefined,
      endDateTime: endDateTime || undefined,
      category: category || undefined
    }
    
    console.log('API: Searching events with params:', searchParams)
    
    const result = await eventService.searchEvents(searchParams)
    
    console.log('API: Found events from sources:', result.events.map(e => e.id.split('_')[0]).join(', '))
    
    return NextResponse.json({
      events: result.events,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      sources: eventService.getAvailableProviders()
    })
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events from providers' },
      { status: 500 }
    )
  }
}