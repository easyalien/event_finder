import type { Event } from '@/types/event'
import type { 
  IEventProvider, 
  EventSearchParams, 
  EventSearchResult 
} from '@/types/eventProvider'

interface TicketmasterEvent {
  id: string
  name: string
  url: string
  dates: {
    start: {
      localDate: string
      localTime?: string
    }
  }
  _embedded?: {
    venues: Array<{
      name: string
      address: {
        line1: string
        line2?: string
        line3?: string
      }
      city: {
        name: string
      }
      state: {
        name: string
        stateCode: string
      }
      postalCode: string
      location: {
        latitude: string
        longitude: string
      }
    }>
  }
  classifications?: Array<{
    segment: {
      name: string
    }
    genre: {
      name: string
    }
  }>
  info?: string
  pleaseNote?: string
  images?: Array<{
    url: string
    width: number
    height: number
  }>
  distance?: number
}

interface TicketmasterResponse {
  _embedded?: {
    events: TicketmasterEvent[]
  }
  page: {
    size: number
    totalElements: number
    totalPages: number
    number: number
  }
}

export class TicketmasterProvider implements IEventProvider {
  readonly name = 'Ticketmaster'
  readonly priority = 100 // High priority - reliable commercial events
  readonly capabilities = {
    locationSearch: true,
    categoryFilter: true,
    dateRange: true,
    pagination: true
  }

  async searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
    if (!this.isAvailable()) {
      throw new Error('Ticketmaster API key is not configured')
    }

    const searchParams = new URLSearchParams({
      postalCode: params.postalCode || '',
      radius: params.radius.toString(),
      size: (params.size || 20).toString(),
      page: (params.page || 0).toString()
    })

    if (params.startDateTime) {
      searchParams.append('startDateTime', params.startDateTime)
    }

    if (params.endDateTime) {
      searchParams.append('endDateTime', params.endDateTime)
    }

    if (params.category) {
      // Map common categories to Ticketmaster classification
      const categoryMapping: Record<string, string> = {
        'music': 'music',
        'sports': 'sports',
        'arts': 'arts',
        'family': 'family'
      }
      
      const tmCategory = categoryMapping[params.category.toLowerCase()]
      if (tmCategory) {
        searchParams.append('classificationName', tmCategory)
      }
    }

    try {
      const response = await fetch(`/api/events?${searchParams}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const data: TicketmasterResponse = await response.json()
      
      const events = data._embedded?.events?.map(this.transformEvent) || []
      
      return {
        events,
        totalCount: data.page.totalElements,
        hasMore: data.page.number < data.page.totalPages - 1,
        source: this.name
      }
    } catch (error) {
      console.error('Error fetching events from Ticketmaster:', error)
      throw error
    }
  }

  isAvailable(): boolean {
    return !!process.env.NEXT_PUBLIC_TICKETMASTER_API_KEY
  }

  private transformEvent = (tmEvent: TicketmasterEvent): Event => {
    const venue = tmEvent._embedded?.venues?.[0]
    const classification = tmEvent.classifications?.[0]
    
    const dateTime = this.parseDateTime(tmEvent.dates.start.localDate, tmEvent.dates.start.localTime)
    
    return {
      id: `tm_${tmEvent.id}`, // Prefix to identify source
      title: tmEvent.name,
      description: this.createDescription(tmEvent),
      date: dateTime,
      venue: venue?.name || 'Venue TBA',
      address: this.formatAddress(venue),
      category: classification?.segment?.name || classification?.genre?.name || 'General',
      distance: tmEvent.distance || 0
    }
  }

  private parseDateTime(localDate: string, localTime?: string): string {
    const date = new Date(localDate)
    
    if (localTime) {
      const [hours, minutes] = localTime.split(':')
      date.setHours(parseInt(hours), parseInt(minutes))
    }
    
    return date.toISOString()
  }

  private createDescription(tmEvent: TicketmasterEvent): string {
    const parts = []
    
    if (tmEvent.info) {
      parts.push(tmEvent.info)
    }
    
    if (tmEvent.pleaseNote) {
      parts.push(tmEvent.pleaseNote)
    }
    
    if (parts.length === 0) {
      const classification = tmEvent.classifications?.[0]
      if (classification?.genre?.name) {
        parts.push(`${classification.genre.name} event`)
      } else {
        parts.push('Event details available on Ticketmaster')
      }
    }
    
    return parts.join(' • ')
  }

  private formatAddress(venue?: TicketmasterEvent['_embedded']['venues'][0]): string {
    if (!venue) return 'Location TBA'
    
    const parts = []
    
    if (venue.address.line1) parts.push(venue.address.line1)
    if (venue.address.line2) parts.push(venue.address.line2)
    if (venue.city.name) parts.push(venue.city.name)
    if (venue.state.stateCode) parts.push(venue.state.stateCode)
    if (venue.postalCode) parts.push(venue.postalCode)
    
    return parts.join(', ')
  }
}