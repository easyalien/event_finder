import type { Event } from '@/types/event'

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

export interface EventSearchParams {
  postalCode: string
  radius: number
  startDateTime?: string
  endDateTime?: string
  size?: number
  page?: number
}

class TicketmasterService {
  private readonly baseUrl = 'https://app.ticketmaster.com/discovery/v2'
  private readonly apiKey = process.env.NEXT_PUBLIC_TICKETMASTER_API_KEY

  async searchEvents(params: EventSearchParams): Promise<Event[]> {
    const searchParams = new URLSearchParams({
      postalCode: params.postalCode,
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

    try {
      const response = await fetch(`/api/events?${searchParams}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const data: TicketmasterResponse = await response.json()
      
      if (!data._embedded?.events) {
        return []
      }

      return data._embedded.events.map(this.transformEvent)
    } catch (error) {
      console.error('Error fetching events:', error)
      throw error
    }
  }

  private transformEvent = (tmEvent: TicketmasterEvent): Event => {
    const venue = tmEvent._embedded?.venues?.[0]
    const classification = tmEvent.classifications?.[0]
    
    const dateTime = this.parseDateTime(tmEvent.dates.start.localDate, tmEvent.dates.start.localTime)
    
    return {
      id: tmEvent.id,
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

  getEventsByTimeframe(events: Event[], timeframe: string): Event[] {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    return events.filter(event => {
      const eventDate = new Date(event.date)
      
      switch (timeframe) {
        case 'today':
          return eventDate >= today && eventDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)
        
        case 'week':
          const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
          return eventDate >= today && eventDate <= weekFromNow
        
        case 'month':
          const monthFromNow = new Date(today)
          monthFromNow.setMonth(today.getMonth() + 1)
          return eventDate >= today && eventDate <= monthFromNow
        
        case '3months':
          const threeMonthsFromNow = new Date(today)
          threeMonthsFromNow.setMonth(today.getMonth() + 3)
          return eventDate >= today && eventDate <= threeMonthsFromNow
        
        default:
          return true
      }
    })
  }
}

export const ticketmasterService = new TicketmasterService()