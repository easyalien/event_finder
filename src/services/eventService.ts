import { EventAggregator } from './eventAggregator'
import { TicketmasterProvider } from './providers/ticketmasterProvider'
import { MeetupProvider } from './providers/meetupProvider'
import { EventbriteProvider } from './providers/eventbriteProvider'
import { SeatGeekProvider } from './providers/seatgeekProvider'
import { BandsinTownProvider } from './providers/bandsintown'
import { YelpProvider } from './providers/yelpProvider'
import { ArtInstituteProvider } from './providers/artInstituteProvider'
import type { Event } from '@/types/event'
import type { EventSearchParams } from '@/types/eventProvider'

class EventService {
  private aggregator: EventAggregator

  constructor() {
    // Initialize providers in priority order
    const providers = [
      new TicketmasterProvider(),  // Priority 100
      new EventbriteProvider(),    // Priority 90
      new SeatGeekProvider(),      // Priority 85
      new MeetupProvider(),        // Priority 80
      new BandsinTownProvider(),   // Priority 75
      new YelpProvider(),          // Priority 70
      new ArtInstituteProvider()   // Priority 65
    ]

    this.aggregator = new EventAggregator({
      providers,
      maxResultsPerProvider: 50,
      enableDeduplication: true,
      parallelRequests: true
    })
  }

  async searchEvents(params: {
    postalCode: string
    radius: number
    startDateTime?: string
    endDateTime?: string
    category?: string
  }) {
    const searchParams: EventSearchParams = {
      postalCode: params.postalCode,
      radius: params.radius,
      startDateTime: params.startDateTime,
      endDateTime: params.endDateTime,
      category: params.category,
      size: 100 // Get more results from each source
    }

    return await this.aggregator.searchEvents(searchParams)
  }

  getEventsByTimeframe(events: Event[], timeframe: string): Event[] {
    return this.aggregator.getEventsByTimeframe(events, timeframe)
  }

  getAvailableProviders(): string[] {
    return this.aggregator.getAvailableProviders()
  }

  getProviderCapabilities() {
    return this.aggregator.getProviderCapabilities()
  }
}

// Export singleton instance
export const eventService = new EventService()