import type { Event } from '@/types/event'
import type { 
  IEventProvider, 
  EventSearchParams, 
  EventSearchResult 
} from '@/types/eventProvider'

interface MeetupEvent {
  id: string
  title: string
  eventUrl: string
  description?: string
  dateTime: string
  going: number
  venue?: {
    name: string
    address: string
    city: string
    state: string
    postalCode: string
    lat: number
    lon: number
  }
  group: {
    name: string
    urlname: string
  }
}

interface MeetupResponse {
  data: {
    keywordSearch: {
      count: number
      edges: Array<{
        cursor: string
        node: {
          id: string
          result: MeetupEvent
        }
      }>
      pageInfo: {
        hasNextPage: boolean
        endCursor: string
      }
    }
  }
}

export class MeetupProvider implements IEventProvider {
  readonly name = 'Meetup'
  readonly priority = 80 // Lower than Ticketmaster - community events
  readonly capabilities = {
    locationSearch: true,
    categoryFilter: false, // Meetup uses keyword search instead
    dateRange: false, // Limited date filtering in GraphQL
    pagination: true
  }

  async searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
    if (!this.isAvailable()) {
      throw new Error('Meetup API access token is not configured')
    }

    // For now, return empty results with a note
    // This demonstrates the architecture - actual implementation would need OAuth setup
    console.warn('Meetup provider is configured but not fully implemented yet. OAuth setup required.')
    
    return {
      events: this.getMockMeetupEvents(params),
      totalCount: 3,
      hasMore: false,
      source: this.name
    }

    // Actual implementation would look like this:
    /*
    const query = `
      query($filter: SearchConnectionFilter!) {
        keywordSearch(filter: $filter) {
          count
          edges {
            cursor
            node {
              id
              result {
                ... on Event {
                  id
                  title
                  eventUrl
                  description
                  dateTime
                  going
                  venue {
                    name
                    address
                    city
                    state
                    postalCode
                    lat
                    lon
                  }
                  group {
                    name
                    urlname
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `

    const variables = {
      filter: {
        query: "events",
        lat: params.latitude || 40.7128, // Default to NYC if no coords
        lon: params.longitude || -74.0060,
        radius: params.radius,
        source: "EVENTS"
      }
    }

    try {
      const response = await fetch('/api/meetup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_MEETUP_ACCESS_TOKEN}`
        },
        body: JSON.stringify({ query, variables })
      })

      if (!response.ok) {
        throw new Error(`Meetup API error: ${response.status}`)
      }

      const data: MeetupResponse = await response.json()
      const events = data.data.keywordSearch.edges.map(edge => 
        this.transformEvent(edge.node.result)
      )

      return {
        events,
        totalCount: data.data.keywordSearch.count,
        hasMore: data.data.keywordSearch.pageInfo.hasNextPage,
        source: this.name
      }
    } catch (error) {
      console.error('Error fetching events from Meetup:', error)
      throw error
    }
    */
  }

  isAvailable(): boolean {
    // For demo purposes, return true. In production, check for OAuth token
    return true
    // return !!process.env.NEXT_PUBLIC_MEETUP_ACCESS_TOKEN
  }

  private getMockMeetupEvents(params: EventSearchParams): Event[] {
    // Mock events to demonstrate multi-provider architecture
    const baseDate = new Date()
    
    return [
      {
        id: 'meetup_tech_1',
        title: 'JavaScript Developers Meetup',
        description: 'Monthly gathering of JavaScript developers to share knowledge and network. This month: React 18 features and Next.js best practices.',
        date: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'TechHub Coworking Space',
        address: '123 Tech St, Innovation District',
        category: 'Technology',
        distance: 2.3
      },
      {
        id: 'meetup_hiking_1',
        title: 'Weekend Nature Hike',
        description: 'Join our hiking group for a scenic 5-mile trail walk. All skill levels welcome. Bring water and comfortable shoes.',
        date: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Sunset Trail Parking',
        address: '456 Nature Way, Mountain View',
        category: 'Outdoors',
        distance: 8.1
      },
      {
        id: 'meetup_book_1',
        title: 'Monthly Book Club Discussion',
        description: 'This month we\'re discussing "The Seven Husbands of Evelyn Hugo". New members always welcome!',
        date: new Date(baseDate.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Corner Coffee Shop',
        address: '789 Reading Ave, Downtown',
        category: 'Literature',
        distance: 1.7
      }
    ]
  }

  private transformEvent(meetupEvent: MeetupEvent): Event {
    return {
      id: `meetup_${meetupEvent.id}`,
      title: meetupEvent.title,
      description: meetupEvent.description || `${meetupEvent.group.name} event`,
      date: meetupEvent.dateTime,
      venue: meetupEvent.venue?.name || meetupEvent.group.name,
      address: this.formatAddress(meetupEvent.venue),
      category: 'Community', // Meetup events are typically community-focused
      distance: 0 // Would need to calculate based on user location
    }
  }

  private formatAddress(venue?: MeetupEvent['venue']): string {
    if (!venue) return 'Location TBA'
    
    const parts = [venue.address, venue.city, venue.state, venue.postalCode]
      .filter(Boolean)
    
    return parts.join(', ')
  }
}