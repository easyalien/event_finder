import { EventAggregator } from '../eventAggregator'
import type { IEventProvider, EventSearchParams, EventSearchResult } from '@/types/eventProvider'
import type { Event } from '@/types/event'

// Mock provider class
class MockProvider implements IEventProvider {
  constructor(
    public name: string,
    public priority: number,
    private mockEvents: Event[],
    private shouldFail: boolean = false
  ) {}

  readonly capabilities = {
    locationSearch: true,
    categoryFilter: true,
    dateRange: true,
    pagination: true
  }

  async searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
    if (this.shouldFail) {
      throw new Error(`${this.name} provider failed`)
    }

    return {
      events: this.mockEvents,
      totalCount: this.mockEvents.length,
      hasMore: false,
      source: this.name
    }
  }

  isAvailable(): boolean {
    return true
  }
}

describe('EventAggregator', () => {
  let aggregator: EventAggregator
  let mockProviders: MockProvider[]

  beforeEach(() => {
    // Create mock events for different providers
    const ticketmasterEvents: Event[] = [
      {
        id: 'tm_1',
        title: 'Concert A',
        description: 'Great concert',
        date: '2024-07-15T19:00:00Z',
        venue: 'Arena 1',
        address: '123 Main St',
        category: 'Music',
        distance: 5.0
      },
      {
        id: 'tm_2',
        title: 'Concert B',
        description: 'Another concert',
        date: '2024-07-16T20:00:00Z',
        venue: 'Arena 2',
        address: '456 Oak St',
        category: 'Music',
        distance: 7.5
      }
    ]

    const eventbriteEvents: Event[] = [
      {
        id: 'eb_1',
        title: 'Workshop A',
        description: 'Professional workshop',
        date: '2024-07-17T14:00:00Z',
        venue: 'Conference Center',
        address: '789 Business Blvd',
        category: 'Business',
        distance: 3.2
      }
    ]

    const yelpEvents: Event[] = [
      {
        id: 'yelp_1',
        title: 'Food Festival',
        description: 'Local food festival',
        date: '2024-07-18T12:00:00Z',
        venue: 'Park Pavilion',
        address: '321 Park Ave',
        category: 'Food',
        distance: 4.1
      }
    ]

    mockProviders = [
      new MockProvider('Ticketmaster', 100, ticketmasterEvents),
      new MockProvider('Eventbrite', 90, eventbriteEvents),
      new MockProvider('Yelp', 70, yelpEvents)
    ]

    aggregator = new EventAggregator({
      providers: mockProviders,
      maxResultsPerProvider: 50,
      enableDeduplication: true,
      parallelRequests: true
    })
  })

  describe('Configuration', () => {
    it('should initialize with correct configuration', () => {
      expect(aggregator).toBeDefined()
    })

    it('should return available providers', () => {
      const providers = aggregator.getAvailableProviders()
      expect(providers).toEqual(['Ticketmaster', 'Eventbrite', 'Yelp'])
    })

    it('should return provider capabilities', () => {
      const capabilities = aggregator.getProviderCapabilities()
      expect(capabilities).toHaveProperty('Ticketmaster')
      expect(capabilities).toHaveProperty('Eventbrite')
      expect(capabilities).toHaveProperty('Yelp')
      
      expect(capabilities.Ticketmaster.locationSearch).toBe(true)
      expect(capabilities.Eventbrite.categoryFilter).toBe(true)
    })
  })

  describe('Event Aggregation', () => {
    it('should aggregate events from all providers', async () => {
      const params: EventSearchParams = {
        postalCode: '90210',
        radius: 25
      }

      const result = await aggregator.searchEvents(params)

      expect(result.events).toHaveLength(4) // 2 + 1 + 1 events
      expect(result.totalCount).toBe(4)
      expect(result.hasMore).toBe(false)
      expect(result.source).toBe('Aggregated')
    })

    it('should sort events by date chronologically', async () => {
      const params: EventSearchParams = {
        postalCode: '90210',
        radius: 25
      }

      const result = await aggregator.searchEvents(params)

      const dates = result.events.map(event => new Date(event.date).getTime())
      
      // Check that dates are in ascending order
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1])
      }
    })

    it('should handle provider failures gracefully', async () => {
      // Add a failing provider
      const failingProvider = new MockProvider('FailingProvider', 95, [], true)
      
      const aggregatorWithFailure = new EventAggregator({
        providers: [failingProvider, ...mockProviders],
        maxResultsPerProvider: 50,
        enableDeduplication: true,
        parallelRequests: true
      })

      const params: EventSearchParams = {
        postalCode: '90210',
        radius: 25
      }

      const result = await aggregatorWithFailure.searchEvents(params)

      // Should still get events from working providers
      expect(result.events).toHaveLength(4)
      expect(result.totalCount).toBe(4)
    })
  })

  describe('Event Deduplication', () => {
    it('should remove duplicate events based on title, date, and venue', async () => {
      // Create providers with duplicate events
      const duplicateEvent: Event = {
        id: 'different_id',
        title: 'Concert A', // Same title as tm_1
        description: 'Duplicate concert',
        date: '2024-07-15T19:00:00Z', // Same date as tm_1
        venue: 'Arena 1', // Same venue as tm_1
        address: '123 Main St',
        category: 'Music',
        distance: 5.0
      }

      const providerWithDuplicate = new MockProvider('DuplicateProvider', 80, [duplicateEvent])
      
      const aggregatorWithDuplicates = new EventAggregator({
        providers: [mockProviders[0], providerWithDuplicate], // Ticketmaster + duplicate
        maxResultsPerProvider: 50,
        enableDeduplication: true,
        parallelRequests: true
      })

      const params: EventSearchParams = {
        postalCode: '90210',
        radius: 25
      }

      const result = await aggregatorWithDuplicates.searchEvents(params)

      // Should only have 2 unique events (tm_1, tm_2), duplicate should be removed
      expect(result.events).toHaveLength(2)
    })

    it('should preserve events when deduplication is disabled', async () => {
      const duplicateEvent: Event = {
        id: 'different_id',
        title: 'Concert A',
        description: 'Duplicate concert',
        date: '2024-07-15T19:00:00Z',
        venue: 'Arena 1',
        address: '123 Main St',
        category: 'Music',
        distance: 5.0
      }

      const providerWithDuplicate = new MockProvider('DuplicateProvider', 80, [duplicateEvent])
      
      const aggregatorNoDedupe = new EventAggregator({
        providers: [mockProviders[0], providerWithDuplicate],
        maxResultsPerProvider: 50,
        enableDeduplication: false, // Disabled
        parallelRequests: true
      })

      const params: EventSearchParams = {
        postalCode: '90210',
        radius: 25
      }

      const result = await aggregatorNoDedupe.searchEvents(params)

      // Should have all 3 events including duplicate
      expect(result.events).toHaveLength(3)
    })
  })

  describe('Timeframe Filtering', () => {
    beforeEach(() => {
      // Create events with different dates for timeframe testing
      const today = new Date()
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

      const timeframedEvents: Event[] = [
        {
          id: 'today_event',
          title: 'Today Event',
          description: 'Event today',
          date: today.toISOString(),
          venue: 'Venue 1',
          address: 'Address 1',
          category: 'Test',
          distance: 1.0
        },
        {
          id: 'tomorrow_event',
          title: 'Tomorrow Event',
          description: 'Event tomorrow',
          date: tomorrow.toISOString(),
          venue: 'Venue 2',
          address: 'Address 2',
          category: 'Test',
          distance: 2.0
        },
        {
          id: 'next_week_event',
          title: 'Next Week Event',
          description: 'Event next week',
          date: nextWeek.toISOString(),
          venue: 'Venue 3',
          address: 'Address 3',
          category: 'Test',
          distance: 3.0
        },
        {
          id: 'next_month_event',
          title: 'Next Month Event',
          description: 'Event next month',
          date: nextMonth.toISOString(),
          venue: 'Venue 4',
          address: 'Address 4',
          category: 'Test',
          distance: 4.0
        }
      ]

      const timeframeProvider = new MockProvider('TimeframeProvider', 100, timeframedEvents)
      
      aggregator = new EventAggregator({
        providers: [timeframeProvider],
        maxResultsPerProvider: 50,
        enableDeduplication: true,
        parallelRequests: true
      })
    })

    it('should filter events for today timeframe', async () => {
      const params: EventSearchParams = {
        postalCode: '90210',
        radius: 25
      }

      const result = await aggregator.searchEvents(params)
      const todayEvents = aggregator.getEventsByTimeframe(result.events, 'today')

      expect(todayEvents).toHaveLength(1)
      expect(todayEvents[0].title).toBe('Today Event')
    })

    it('should filter events for week timeframe', async () => {
      const params: EventSearchParams = {
        postalCode: '90210',
        radius: 25
      }

      const result = await aggregator.searchEvents(params)
      const weekEvents = aggregator.getEventsByTimeframe(result.events, 'week')

      expect(weekEvents).toHaveLength(3) // today, tomorrow, next week
      expect(weekEvents.map(e => e.title)).toContain('Today Event')
      expect(weekEvents.map(e => e.title)).toContain('Tomorrow Event')
      expect(weekEvents.map(e => e.title)).toContain('Next Week Event')
    })

    it('should filter events for month timeframe', async () => {
      const params: EventSearchParams = {
        postalCode: '90210',
        radius: 25
      }

      const result = await aggregator.searchEvents(params)
      const monthEvents = aggregator.getEventsByTimeframe(result.events, 'month')

      expect(monthEvents).toHaveLength(4) // All events within a month
    })

    it('should return all events for unknown timeframe', async () => {
      const params: EventSearchParams = {
        postalCode: '90210',
        radius: 25
      }

      const result = await aggregator.searchEvents(params)
      const allEvents = aggregator.getEventsByTimeframe(result.events, 'unknown')

      expect(allEvents).toHaveLength(4) // All events
    })
  })

  describe('Performance and Concurrency', () => {
    it('should handle parallel requests correctly', async () => {
      const startTime = Date.now()
      
      const params: EventSearchParams = {
        postalCode: '90210',
        radius: 25
      }

      const result = await aggregator.searchEvents(params)
      
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result.events).toHaveLength(4)
      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(1000) // Should complete quickly
    })

    it('should respect maxResultsPerProvider limit', async () => {
      // Create a provider with many events
      const manyEvents: Event[] = Array.from({ length: 100 }, (_, i) => ({
        id: `event_${i}`,
        title: `Event ${i}`,
        description: `Description ${i}`,
        date: new Date(Date.now() + i * 60000).toISOString(),
        venue: `Venue ${i}`,
        address: `Address ${i}`,
        category: 'Test',
        distance: i
      }))

      const limitedAggregator = new EventAggregator({
        providers: [new MockProvider('ManyEventsProvider', 100, manyEvents)],
        maxResultsPerProvider: 10, // Limit to 10
        enableDeduplication: true,
        parallelRequests: true
      })

      const params: EventSearchParams = {
        postalCode: '90210',
        radius: 25
      }

      const result = await limitedAggregator.searchEvents(params)

      expect(result.events.length).toBeLessThanOrEqual(10)
    })
  })
})