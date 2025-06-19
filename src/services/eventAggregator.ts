import type { Event } from '@/types/event'
import type { 
  IEventProvider, 
  EventSearchParams, 
  EventSearchResult, 
  EventAggregatorConfig 
} from '@/types/eventProvider'

export class EventAggregator {
  private providers: IEventProvider[]
  private config: EventAggregatorConfig

  constructor(config: EventAggregatorConfig) {
    this.providers = config.providers.sort((a, b) => b.priority - a.priority)
    this.config = {
      maxResultsPerProvider: 50,
      enableDeduplication: true,
      parallelRequests: true,
      ...config
    }
  }

  async searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
    const availableProviders = this.providers.filter(provider => provider.isAvailable())
    
    if (availableProviders.length === 0) {
      throw new Error('No event providers are available')
    }

    try {
      const results = this.config.parallelRequests 
        ? await this.searchParallel(availableProviders, params)
        : await this.searchSequential(availableProviders, params)

      const aggregatedEvents = this.config.enableDeduplication 
        ? this.deduplicateEvents(results)
        : results.flatMap(result => result.events)

      return {
        events: aggregatedEvents,
        totalCount: aggregatedEvents.length,
        hasMore: results.some(result => result.hasMore),
        source: 'aggregated'
      }
    } catch (error) {
      console.error('Error in EventAggregator:', error)
      throw error
    }
  }

  private async searchParallel(
    providers: IEventProvider[], 
    params: EventSearchParams
  ): Promise<EventSearchResult[]> {
    const searchParams = {
      ...params,
      size: this.config.maxResultsPerProvider
    }

    const promises = providers.map(async provider => {
      try {
        return await provider.searchEvents(searchParams)
      } catch (error) {
        console.warn(`Provider ${provider.name} failed:`, error)
        return {
          events: [],
          totalCount: 0,
          hasMore: false,
          source: provider.name
        }
      }
    })

    return Promise.all(promises)
  }

  private async searchSequential(
    providers: IEventProvider[], 
    params: EventSearchParams
  ): Promise<EventSearchResult[]> {
    const results: EventSearchResult[] = []
    const searchParams = {
      ...params,
      size: this.config.maxResultsPerProvider
    }

    for (const provider of providers) {
      try {
        const result = await provider.searchEvents(searchParams)
        results.push(result)
      } catch (error) {
        console.warn(`Provider ${provider.name} failed:`, error)
        results.push({
          events: [],
          totalCount: 0,
          hasMore: false,
          source: provider.name
        })
      }
    }

    return results
  }

  private deduplicateEvents(results: EventSearchResult[]): Event[] {
    const allEvents = results.flatMap(result => result.events)
    const seen = new Set<string>()
    const deduplicated: Event[] = []

    for (const event of allEvents) {
      const key = this.generateDeduplicationKey(event)
      
      if (!seen.has(key)) {
        seen.add(key)
        deduplicated.push(event)
      }
    }

    return deduplicated.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  private generateDeduplicationKey(event: Event): string {
    // Create a key based on title, date, and venue for deduplication
    const date = new Date(event.date).toDateString()
    const title = event.title.toLowerCase().trim()
    const venue = event.venue.toLowerCase().trim()
    
    return `${title}|${date}|${venue}`
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

  getAvailableProviders(): string[] {
    return this.providers
      .filter(provider => provider.isAvailable())
      .map(provider => provider.name)
  }

  getProviderCapabilities(): Record<string, IEventProvider['capabilities']> {
    return this.providers.reduce((acc, provider) => {
      acc[provider.name] = provider.capabilities
      return acc
    }, {} as Record<string, IEventProvider['capabilities']>)
  }
}