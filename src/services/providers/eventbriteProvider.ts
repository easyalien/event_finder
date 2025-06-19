import type { Event } from '@/types/event'
import type { 
  IEventProvider, 
  EventSearchParams, 
  EventSearchResult 
} from '@/types/eventProvider'
import { geocodingService } from '@/services/geocoding'
import { venueDiscoveryService } from '@/services/venueDiscovery'

interface EventbriteEvent {
  id: string
  name: {
    text: string
  }
  description?: {
    text: string
  }
  start: {
    local: string
    timezone: string
  }
  end: {
    local: string
    timezone: string
  }
  url: string
  venue_id: string
  venue?: {
    id: string
    name: string
    address: {
      address_1?: string
      city?: string
      region?: string
      postal_code?: string
      country?: string
    }
    latitude?: string
    longitude?: string
  }
  category_id?: string
  organization_id: string
}

interface EventbriteVenue {
  id: string
  name: string
  address: {
    address_1?: string
    city?: string
    region?: string
    postal_code?: string
    country?: string
  }
  latitude?: string
  longitude?: string
}

export class EventbriteProvider implements IEventProvider {
  readonly name = 'Eventbrite'
  readonly priority = 90 // High priority - professional events
  readonly capabilities = {
    locationSearch: true, // Via our venue discovery workaround
    categoryFilter: false,
    dateRange: true,
    pagination: true
  }

  async searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
    // If we have Eventbrite API token, try direct organization search first
    if (this.isAvailable()) {
      try {
        const directEvents = await this.searchEventbriteDirectly(params)
        if (directEvents.length > 0) {
          return {
            events: directEvents,
            totalCount: directEvents.length,
            hasMore: false,
            source: this.name
          }
        }
      } catch (error) {
        console.warn('Direct Eventbrite search failed:', error)
      }
    }

    // Check if Foursquare venue discovery is available for enhanced search
    if (!venueDiscoveryService.isAvailable()) {
      console.warn('Eventbrite provider using mock data. Foursquare OAuth not connected and no direct events found.')
      return {
        events: this.getMockEventbriteEvents(params),
        totalCount: 2,
        hasMore: false,
        source: this.name
      }
    }

    if (!this.isAvailable()) {
      console.warn('Eventbrite provider is configured but API token is needed for full functionality.')
      return {
        events: this.getMockEventbriteEvents(params),
        totalCount: 2,
        hasMore: false,
        source: this.name
      }
    }

    try {
      // Step 1: Convert ZIP code to coordinates
      const geoResult = await geocodingService.geocodeZipCode(params.postalCode!)
      
      // Step 2: Find venues in the area using Foursquare
      const venueResult = await venueDiscoveryService.searchVenues({
        latitude: geoResult.coordinates.latitude,
        longitude: geoResult.coordinates.longitude,
        radius: params.radius * 1609.34, // Convert miles to meters
        limit: 20
      })

      // Step 3: For each venue, try to find matching Eventbrite venue and get events
      const allEvents: Event[] = []
      
      for (const venue of venueResult.venues) {
        try {
          const eventbriteEvents = await this.getEventsByVenueName(venue.name, venue.address)
          allEvents.push(...eventbriteEvents)
        } catch (error) {
          console.warn(`Failed to get events for venue ${venue.name}:`, error)
          // Continue with next venue
        }
      }

      // Remove duplicates and sort by date
      const uniqueEvents = this.removeDuplicateEvents(allEvents)
      const sortedEvents = uniqueEvents.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      return {
        events: sortedEvents,
        totalCount: sortedEvents.length,
        hasMore: false, // For now, we get all events from found venues
        source: this.name
      }
    } catch (error) {
      console.error('Error in Eventbrite provider:', error)
      // Fall back to mock data on error
      return {
        events: this.getMockEventbriteEvents(params),
        totalCount: 2,
        hasMore: false,
        source: this.name
      }
    }
  }

  isAvailable(): boolean {
    return !!process.env.NEXT_PUBLIC_EVENTBRITE_API_TOKEN
  }

  private async searchEventbriteDirectly(params: EventSearchParams): Promise<Event[]> {
    // Try searching popular organizations/venues in the area
    // This is a simplified approach since we can't do location search directly
    const popularOrgIds = [
      // Add some popular organization IDs here for testing
      // These would typically be fetched based on location
    ]

    if (popularOrgIds.length === 0) {
      return [] // No organizations to search
    }

    const allEvents: Event[] = []

    for (const orgId of popularOrgIds) {
      try {
        const response = await fetch(`/api/eventbrite/organizations/${orgId}/events`)
        if (response.ok) {
          const data = await response.json()
          if (data.events) {
            const events = data.events.map(this.transformEvent)
            allEvents.push(...events)
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch events for org ${orgId}:`, error)
      }
    }

    return allEvents
  }

  private async getEventsByVenueName(venueName: string, venueAddress: string): Promise<Event[]> {
    // This would be the actual implementation with Eventbrite API
    /*
    try {
      // First, search for Eventbrite venue by name/address
      const venueSearchParams = new URLSearchParams({
        q: venueName,
        location.address: venueAddress.split(',')[0], // First part of address
        location.within: '1mi'
      })

      const venueResponse = await fetch(`/api/eventbrite/venues/search?${venueSearchParams}`)
      const venueData = await venueResponse.json()
      
      if (!venueData.venues || venueData.venues.length === 0) {
        return []
      }

      // Get the best matching venue
      const matchedVenue = venueData.venues[0]
      
      // Now get events for this venue
      const eventsResponse = await fetch(`/api/eventbrite/venues/${matchedVenue.id}/events`)
      const eventsData = await eventsResponse.json()
      
      return eventsData.events.map(this.transformEvent)
    } catch (error) {
      console.error('Error fetching Eventbrite events:', error)
      return []
    }
    */

    // For now, return empty array
    return []
  }

  private getMockEventbriteEvents(params: EventSearchParams): Event[] {
    // Mock events to demonstrate the integration
    const baseDate = new Date()
    
    return [
      {
        id: 'eb_workshop_1',
        title: 'Digital Marketing Workshop',
        description: 'Learn the latest digital marketing strategies from industry experts. Covers social media, SEO, content marketing, and analytics.',
        date: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Business Innovation Center',
        address: '567 Commerce Blvd, Business District',
        category: 'Business',
        distance: 4.2
      },
      {
        id: 'eb_conference_1',
        title: 'Tech Innovation Summit 2024',
        description: 'Annual conference bringing together entrepreneurs, investors, and technology leaders. Keynotes, panels, and networking.',
        date: new Date(baseDate.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Convention Center Hall A',
        address: '890 Convention Dr, Downtown',
        category: 'Technology',
        distance: 6.8
      }
    ]
  }

  private transformEvent(ebEvent: EventbriteEvent): Event {
    return {
      id: `eb_${ebEvent.id}`,
      title: ebEvent.name.text,
      description: ebEvent.description?.text || 'Professional event hosted on Eventbrite',
      date: ebEvent.start.local,
      venue: ebEvent.venue?.name || 'Venue TBA',
      address: this.formatAddress(ebEvent.venue),
      category: 'Professional', // Eventbrite events are typically professional/business
      distance: 0 // Would need to calculate based on user location
    }
  }

  private formatAddress(venue?: EventbriteVenue): string {
    if (!venue?.address) return 'Location TBA'
    
    const parts = [
      venue.address.address_1,
      venue.address.city,
      venue.address.region,
      venue.address.postal_code
    ].filter(Boolean)
    
    return parts.join(', ')
  }

  private removeDuplicateEvents(events: Event[]): Event[] {
    const seen = new Set<string>()
    const unique: Event[] = []
    
    for (const event of events) {
      // Create a key based on title, date, and venue
      const key = `${event.title.toLowerCase().trim()}|${event.date}|${event.venue.toLowerCase().trim()}`
      
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(event)
      }
    }
    
    return unique
  }

  // Helper method for venue matching (to be implemented)
  private calculateVenueMatchScore(foursquareVenue: any, eventbriteVenue: EventbriteVenue): number {
    // This would implement fuzzy string matching between venue names and addresses
    // For now, return a simple score
    return 0.5
  }
}