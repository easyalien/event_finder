import type { Event } from '@/types/event'
import type { 
  IEventProvider, 
  EventSearchParams, 
  EventSearchResult 
} from '@/types/eventProvider'

interface SeatGeekEvent {
  id: number
  title: string
  url: string
  datetime_utc: string
  datetime_local: string
  venue: {
    id: number
    name: string
    address: string
    city: string
    state: string
    postal_code: string
    country: string
    location: {
      lat: number
      lon: number
    }
  }
  performers: Array<{
    id: number
    name: string
    short_name: string
    url: string
    image: string
    category: string
    type: string
  }>
  taxonomies: Array<{
    id: number
    name: string
    parent_id: number | null
  }>
  type: string
  description?: string
  stats: {
    listing_count: number
    average_price: number
    lowest_price: number
    highest_price: number
  }
}

interface SeatGeekResponse {
  events: SeatGeekEvent[]
  meta: {
    total: number
    took: number
    page: number
    per_page: number
    geolocation?: {
      lat: number
      lon: number
      city: string
      state: string
      country: string
      range: string
    }
  }
}

export class SeatGeekProvider implements IEventProvider {
  readonly name = 'SeatGeek'
  readonly priority = 85 // Between Eventbrite and Meetup
  readonly capabilities = {
    locationSearch: true,
    categoryFilter: true,
    dateRange: true,
    pagination: true
  }

  private readonly baseUrl = 'https://api.seatgeek.com/2'
  private readonly clientId = process.env.NEXT_PUBLIC_SEATGEEK_CLIENT_ID

  async searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
    if (!this.isAvailable()) {
      console.warn('SeatGeek provider using mock data. Client ID not configured.')
      return {
        events: this.getMockSeatGeekEvents(params),
        totalCount: 3,
        hasMore: false,
        source: this.name
      }
    }

    try {
      const response = await fetch(this.buildApiUrl(params))
      
      if (!response.ok) {
        throw new Error(`SeatGeek API error: ${response.status} ${response.statusText}`)
      }

      const data: SeatGeekResponse = await response.json()
      
      const events = data.events.map(this.transformEvent)
      
      return {
        events,
        totalCount: data.meta.total,
        hasMore: (data.meta.page * data.meta.per_page) < data.meta.total,
        source: this.name
      }
    } catch (error) {
      console.error('Error fetching events from SeatGeek:', error)
      // Fall back to mock data on error
      return {
        events: this.getMockSeatGeekEvents(params),
        totalCount: 3,
        hasMore: false,
        source: this.name
      }
    }
  }

  isAvailable(): boolean {
    return !!this.clientId
  }

  private buildApiUrl(params: EventSearchParams): string {
    const searchParams = new URLSearchParams({
      client_id: this.clientId!,
      per_page: (params.size || 20).toString(),
      page: ((params.page || 0) + 1).toString() // SeatGeek uses 1-based pagination
    })

    // Add location search using postal code
    if (params.postalCode) {
      searchParams.append('postal_code', params.postalCode)
      searchParams.append('range', `${params.radius}mi`)
    }

    // Add latitude/longitude if available
    if (params.latitude && params.longitude) {
      searchParams.append('lat', params.latitude.toString())
      searchParams.append('lon', params.longitude.toString())
      searchParams.append('range', `${params.radius}mi`)
    }

    // Add date range if specified
    if (params.startDateTime) {
      searchParams.append('datetime_utc.gte', params.startDateTime)
    }

    if (params.endDateTime) {
      searchParams.append('datetime_utc.lte', params.endDateTime)
    }

    // Add category filter if specified
    if (params.category) {
      const categoryMapping: Record<string, string> = {
        'music': 'concert',
        'sports': 'sports',
        'theater': 'theater',
        'comedy': 'comedy'
      }
      
      const seatgeekType = categoryMapping[params.category.toLowerCase()]
      if (seatgeekType) {
        searchParams.append('type', seatgeekType)
      }
    }

    return `${this.baseUrl}/events?${searchParams.toString()}`
  }

  private transformEvent = (sgEvent: SeatGeekEvent): Event => {
    const mainPerformer = sgEvent.performers?.[0]
    const category = this.getCategoryFromTaxonomies(sgEvent.taxonomies) || 
                    mainPerformer?.category || 
                    sgEvent.type || 
                    'Entertainment'

    return {
      id: `sg_${sgEvent.id}`,
      title: sgEvent.title,
      description: this.createDescription(sgEvent),
      date: sgEvent.datetime_local,
      venue: sgEvent.venue.name,
      address: this.formatAddress(sgEvent.venue),
      category: this.formatCategory(category),
      distance: 0 // SeatGeek doesn't provide distance in the response
    }
  }

  private getCategoryFromTaxonomies(taxonomies: SeatGeekEvent['taxonomies']): string | null {
    if (!taxonomies || taxonomies.length === 0) return null
    
    // Get the most specific taxonomy (one with parent_id)
    const specificTaxonomy = taxonomies.find(tax => tax.parent_id !== null)
    if (specificTaxonomy) return specificTaxonomy.name
    
    // Fall back to the first taxonomy
    return taxonomies[0]?.name || null
  }

  private createDescription(sgEvent: SeatGeekEvent): string {
    const parts = []
    
    if (sgEvent.description) {
      parts.push(sgEvent.description)
    } else {
      // Create description from performers and venue
      if (sgEvent.performers && sgEvent.performers.length > 0) {
        const performers = sgEvent.performers.map(p => p.name).join(', ')
        parts.push(`Featuring ${performers}`)
      }
      
      if (sgEvent.stats.listing_count > 0) {
        parts.push(`Tickets starting at $${sgEvent.stats.lowest_price}`)
      }
    }
    
    if (parts.length === 0) {
      parts.push('Live event - get your tickets on SeatGeek!')
    }
    
    return parts.join(' • ')
  }

  private formatAddress(venue: SeatGeekEvent['venue']): string {
    const parts = [venue.address, venue.city, venue.state, venue.postal_code]
      .filter(Boolean)
    
    return parts.join(', ')
  }

  private formatCategory(category: string): string {
    // Capitalize and clean up category names
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  private getMockSeatGeekEvents(params: EventSearchParams): Event[] {
    // Mock events to demonstrate the integration
    const baseDate = new Date()
    
    return [
      {
        id: 'sg_mock_1',
        title: 'Lakers vs Warriors',
        description: 'NBA Basketball game at Crypto.com Arena. Premium seats available starting at $89.',
        date: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Crypto.com Arena',
        address: '1111 S Figueroa St, Los Angeles, CA 90015',
        category: 'Sports',
        distance: 3.2
      },
      {
        id: 'sg_mock_2',
        title: 'Taylor Swift - The Eras Tour',
        description: 'Pop superstar Taylor Swift brings her record-breaking Eras Tour. Tickets starting at $199.',
        date: new Date(baseDate.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'SoFi Stadium',
        address: '1001 Stadium Dr, Inglewood, CA 90301',
        category: 'Music',
        distance: 5.7
      },
      {
        id: 'sg_mock_3',
        title: 'Hamilton',
        description: 'The award-winning Broadway musical comes to Los Angeles. Evening show with premium orchestra seating.',
        date: new Date(baseDate.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Hollywood Pantages Theatre',
        address: '6233 Hollywood Blvd, Los Angeles, CA 90028',
        category: 'Theater',
        distance: 4.1
      }
    ]
  }
}