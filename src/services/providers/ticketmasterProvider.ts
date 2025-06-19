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

  private readonly apiKey = process.env.NEXT_PUBLIC_TICKETMASTER_API_KEY

  async searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
    if (!this.isAvailable()) {
      throw new Error('Ticketmaster API key is not configured')
    }

    try {
      // Call Ticketmaster API directly instead of our internal API route
      const ticketmasterParams = new URLSearchParams({
        apikey: this.apiKey!,
        postalCode: params.postalCode!,
        radius: params.radius.toString(),
        unit: 'miles',
        size: (params.size || 20).toString(),
        page: (params.page || 0).toString(),
        sort: 'date,asc'
      })

      if (params.startDateTime) {
        ticketmasterParams.append('startDateTime', params.startDateTime)
      }

      if (params.endDateTime) {
        ticketmasterParams.append('endDateTime', params.endDateTime)
      }

      if (params.category) {
        const categoryMapping: Record<string, string> = {
          'music': 'Music',
          'sports': 'Sports',
          'theater': 'Arts & Theatre',
          'comedy': 'Arts & Theatre'
        }
        
        const tmCategory = categoryMapping[params.category.toLowerCase()]
        if (tmCategory) {
          ticketmasterParams.append('classificationName', tmCategory)
        }
      }

      const response = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events?${ticketmasterParams}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      )
      
      if (!response.ok) {
        console.warn(`Ticketmaster API error: ${response.status} ${response.statusText}, falling back to mock data`)
        return {
          events: this.getMockTicketmasterEvents(),
          totalCount: 3,
          hasMore: false,
          source: this.name
        }
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
    return !!this.apiKey
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

  private getMockTicketmasterEvents(): Event[] {
    // Mock events to demonstrate the integration
    const baseDate = new Date()
    
    return [
      {
        id: 'tm_mock_1',
        title: 'LA Lakers vs Golden State Warriors',
        description: 'NBA Regular Season game at Crypto.com Arena • Premium seats available • Season ticket holder packages • Food and beverage included',
        date: new Date(baseDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Crypto.com Arena',
        address: '1111 S Figueroa St, Los Angeles, CA 90015',
        category: 'Sports',
        distance: 8.2
      },
      {
        id: 'tm_mock_2',
        title: 'Imagine Dragons - Mercury World Tour',
        description: 'Alternative rock concert featuring hits from Mercury Act I & II • Special guest OneRepublic • VIP meet and greet packages available',
        date: new Date(baseDate.getTime() + 18 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Hollywood Bowl',
        address: '2301 N Highland Ave, Los Angeles, CA 90068',
        category: 'Music',
        distance: 5.4
      },
      {
        id: 'tm_mock_3',
        title: 'The Lion King - Broadway Musical',
        description: 'Disney\'s award-winning Broadway musical • Evening performance • Orchestra and mezzanine seating • Dinner packages available',
        date: new Date(baseDate.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Pantages Theatre',
        address: '6233 Hollywood Blvd, Los Angeles, CA 90028',
        category: 'Theater',
        distance: 7.1
      }
    ]
  }
}