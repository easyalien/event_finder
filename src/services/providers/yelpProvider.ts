import type { Event } from '@/types/event'
import type { 
  IEventProvider, 
  EventSearchParams, 
  EventSearchResult 
} from '@/types/eventProvider'
import { calculateDistance } from '@/utils/distance'
import { geocodingService } from '@/services/geocoding'

interface YelpEvent {
  id: string
  name: string
  description: string
  event_site_url: string
  image_url: string
  is_free: boolean
  is_canceled: boolean
  category: string
  interested_count: number
  attending_count: number
  time_start: string
  time_end: string
  location: {
    address1: string
    address2?: string
    address3?: string
    city: string
    zip_code: string
    country: string
    state: string
    display_address: string[]
    cross_streets?: string
  }
  latitude: number
  longitude: number
  business_id?: string
  tickets_url?: string
  cost?: number
  cost_max?: number
}

interface YelpEventsResponse {
  events: YelpEvent[]
  total: number
}

export class YelpProvider implements IEventProvider {
  readonly name = 'Yelp'
  readonly priority = 70 // Below Bandsintown, above others
  readonly capabilities = {
    locationSearch: true,
    categoryFilter: false, // Yelp doesn't have extensive category filtering for events
    dateRange: true,
    pagination: true
  }

  private readonly baseUrl = 'https://api.yelp.com/v3'
  private readonly apiKey = process.env.YELP_FUSION_API_KEY

  async searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
    if (!this.isAvailable()) {
      console.warn('Yelp provider using mock data. API key not configured.')
      return {
        events: this.getMockYelpEvents(params),
        totalCount: 3,
        hasMore: false,
        source: this.name
      }
    }

    try {
      // Step 1: Convert ZIP code to coordinates for distance calculation
      const geoResult = await geocodingService.geocodeZipCode(params.postalCode!)
      const userLat = geoResult.coordinates.latitude
      const userLon = geoResult.coordinates.longitude

      // Step 2: Build Yelp events search URL
      const searchParams = new URLSearchParams({
        latitude: userLat.toString(),
        longitude: userLon.toString(),
        radius: Math.min(params.radius * 1609, 40000).toString(), // Convert miles to meters, max 40km
        limit: (params.size || 20).toString(),
        sort_by: 'time_asc'
      })

      // Add date filtering if specified
      if (params.startDateTime) {
        const startTimestamp = Math.floor(new Date(params.startDateTime).getTime() / 1000)
        searchParams.append('start_date', startTimestamp.toString())
      }

      if (params.endDateTime) {
        const endTimestamp = Math.floor(new Date(params.endDateTime).getTime() / 1000)
        searchParams.append('end_date', endTimestamp.toString())
      }

      const response = await fetch(`${this.baseUrl}/events?${searchParams}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        console.warn(`Yelp API error: ${response.status} ${response.statusText}, falling back to mock data`)
        return {
          events: this.getMockYelpEvents(params),
          totalCount: 3,
          hasMore: false,
          source: this.name
        }
      }

      const data: YelpEventsResponse = await response.json()
      
      // Filter events by distance and transform
      const eventsWithinRadius = data.events.filter(yelpEvent => {
        const distance = calculateDistance(
          userLat,
          userLon,
          yelpEvent.latitude,
          yelpEvent.longitude
        )
        return distance <= params.radius
      })

      const events = eventsWithinRadius.map(yelpEvent => 
        this.transformEvent(yelpEvent, userLat, userLon)
      )

      return {
        events,
        totalCount: data.total,
        hasMore: data.events.length === (params.size || 20),
        source: this.name
      }
    } catch (error) {
      console.error('Error fetching events from Yelp:', error)
      // Fall back to mock data on error
      return {
        events: this.getMockYelpEvents(params),
        totalCount: 3,
        hasMore: false,
        source: this.name
      }
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }

  private transformEvent = (yelpEvent: YelpEvent, userLat: number, userLon: number): Event => {
    const distance = calculateDistance(
      userLat,
      userLon,
      yelpEvent.latitude,
      yelpEvent.longitude
    )

    return {
      id: `yelp_${yelpEvent.id}`,
      title: yelpEvent.name,
      description: this.createDescription(yelpEvent),
      date: yelpEvent.time_start,
      venue: this.extractVenueName(yelpEvent),
      address: yelpEvent.location.display_address.join(', '),
      category: this.formatCategory(yelpEvent.category),
      distance: Math.round(distance * 10) / 10 // Round to 1 decimal place
    }
  }

  private createDescription(yelpEvent: YelpEvent): string {
    const parts = []
    
    if (yelpEvent.description && yelpEvent.description.trim()) {
      parts.push(yelpEvent.description.trim())
    }
    
    if (yelpEvent.is_free) {
      parts.push('Free admission')
    } else if (yelpEvent.cost) {
      if (yelpEvent.cost_max && yelpEvent.cost_max !== yelpEvent.cost) {
        parts.push(`$${yelpEvent.cost} - $${yelpEvent.cost_max}`)
      } else {
        parts.push(`$${yelpEvent.cost}`)
      }
    }
    
    if (yelpEvent.interested_count > 0) {
      parts.push(`${yelpEvent.interested_count} interested`)
    }
    
    if (yelpEvent.attending_count > 0) {
      parts.push(`${yelpEvent.attending_count} attending`)
    }

    if (yelpEvent.tickets_url) {
      parts.push('Tickets available online')
    }
    
    if (parts.length === 0) {
      parts.push('Local event discovered on Yelp')
    }
    
    return parts.join(' • ')
  }

  private extractVenueName(yelpEvent: YelpEvent): string {
    // Try to extract venue name from the event name or location
    // This is a heuristic since Yelp events might not always have explicit venue names
    
    if (yelpEvent.business_id) {
      // If there's a business associated, we could potentially fetch business details
      // For now, use a generic venue name
      return 'Local Business Venue'
    }
    
    // Check if location has a specific name in the address
    const address = yelpEvent.location.display_address[0]
    if (address && !address.match(/^\d+/)) {
      // If address doesn't start with a number, it might be a venue name
      return address
    }
    
    return `Venue in ${yelpEvent.location.city}`
  }

  private formatCategory(category: string): string {
    if (!category) return 'Local Event'
    
    // Capitalize and clean up category names
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  private getMockYelpEvents(params: EventSearchParams): Event[] {
    // Mock events to demonstrate the integration
    const baseDate = new Date()
    
    return [
      {
        id: 'yelp_mock_1',
        title: 'Local Art Gallery Opening',
        description: 'Contemporary art exhibition featuring local artists • Free admission • Wine and appetizers provided • Meet the artists',
        date: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Downtown Art Gallery',
        address: '456 Arts District Blvd, Beverly Hills, CA 90210',
        category: 'Arts & Culture',
        distance: 2.1
      },
      {
        id: 'yelp_mock_2',
        title: 'Farmers Market & Live Music',
        description: 'Weekly farmers market with fresh local produce • Live acoustic music • 25 vendors • Pet-friendly event',
        date: new Date(baseDate.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'City Park Pavilion',
        address: '789 Park Ave, Beverly Hills, CA 90210',
        category: 'Community',
        distance: 1.8
      },
      {
        id: 'yelp_mock_3',
        title: 'Wine Tasting & Food Pairing',
        description: 'Premium wine tasting featuring California vintages • Artisanal cheese and charcuterie pairings • $45 per person • Limited seating',
        date: new Date(baseDate.getTime() + 16 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Beverly Hills Wine Bar',
        address: '321 Rodeo Dr, Beverly Hills, CA 90210',
        category: 'Food & Drink',
        distance: 3.7
      }
    ]
  }
}