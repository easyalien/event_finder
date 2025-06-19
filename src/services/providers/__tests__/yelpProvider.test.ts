import { YelpProvider } from '../yelpProvider'
import type { EventSearchParams } from '@/types/eventProvider'

// Mock fetch
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

// Mock geocoding service
jest.mock('@/services/geocoding', () => ({
  geocodingService: {
    geocodeZipCode: jest.fn()
  }
}))

// Mock distance calculation
jest.mock('@/utils/distance', () => ({
  calculateDistance: jest.fn()
}))

describe('YelpProvider', () => {
  let provider: YelpProvider
  
  beforeEach(() => {
    provider = new YelpProvider()
    mockFetch.mockClear()
  })

  describe('Provider Configuration', () => {
    it('should have correct name and priority', () => {
      expect(provider.name).toBe('Yelp')
      expect(provider.priority).toBe(70)
    })

    it('should have appropriate capabilities', () => {
      expect(provider.capabilities).toEqual({
        locationSearch: true,
        categoryFilter: false, // Yelp doesn't have extensive category filtering for events
        dateRange: true,
        pagination: true
      })
    })

    it('should be available when API key is set', () => {
      expect(provider.isAvailable()).toBe(true)
    })
  })

  describe('API Integration', () => {
    const mockSearchParams: EventSearchParams = {
      postalCode: '90210',
      radius: 25,
      size: 20
    }

    beforeEach(() => {
      // Mock geocoding service
      const { geocodingService } = require('@/services/geocoding')
      geocodingService.geocodeZipCode.mockResolvedValue({
        coordinates: { latitude: 34.0522, longitude: -118.2437 }
      })

      // Mock distance calculation
      const { calculateDistance } = require('@/utils/distance')
      calculateDistance.mockReturnValue(5.2)
    })

    it('should make correct API call to Yelp Events endpoint', async () => {
      const mockYelpEvent = {
        id: 'yelp-event-123',
        name: 'Wine Tasting Event',
        description: 'Premium wine tasting experience',
        time_start: '2024-07-15T19:00:00Z',
        is_free: false,
        category: 'food_and_drink',
        interested_count: 45,
        attending_count: 12,
        location: {
          address1: '123 Main St',
          city: 'Beverly Hills',
          state: 'CA',
          zip_code: '90210',
          display_address: ['123 Main St', 'Beverly Hills, CA 90210']
        },
        latitude: 34.0522,
        longitude: -118.2437,
        cost: 75,
        tickets_url: 'https://example.com/tickets'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [mockYelpEvent],
          total: 1
        }),
      } as Response)

      const result = await provider.searchEvents(mockSearchParams)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.yelp.com/v3/events'),
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test_yelp_api_key',
            'Accept': 'application/json'
          }
        })
      )

      const fetchCall = mockFetch.mock.calls[0]
      const url = fetchCall[0] as string
      
      expect(url).toContain('latitude=34.0522')
      expect(url).toContain('longitude=-118.2437')
      expect(url).toContain('radius=40233') // 25 miles converted to meters
      expect(url).toContain('limit=20')

      expect(result.events).toHaveLength(1)
      expect(result.events[0].id).toBe('yelp_yelp-event-123')
      expect(result.events[0].title).toBe('Wine Tasting Event')
      expect(result.source).toBe('Yelp')
    })

    it('should include date parameters when provided', async () => {
      const paramsWithDates: EventSearchParams = {
        ...mockSearchParams,
        startDateTime: '2024-07-01T00:00:00Z',
        endDateTime: '2024-07-31T23:59:59Z'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [], total: 0 }),
      } as Response)

      await provider.searchEvents(paramsWithDates)

      const fetchCall = mockFetch.mock.calls[0]
      const url = fetchCall[0] as string
      
      // Yelp uses Unix timestamps for dates
      const startTimestamp = Math.floor(new Date('2024-07-01T00:00:00Z').getTime() / 1000)
      const endTimestamp = Math.floor(new Date('2024-07-31T23:59:59Z').getTime() / 1000)
      
      expect(url).toContain(`start_date=${startTimestamp}`)
      expect(url).toContain(`end_date=${endTimestamp}`)
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response)

      const result = await provider.searchEvents(mockSearchParams)

      expect(result.events).toHaveLength(3) // Mock events
      expect(result.events[0].id).toBe('yelp_mock_1')
      expect(result.source).toBe('Yelp')
    })

    it('should filter events by radius', async () => {
      const { calculateDistance } = require('@/utils/distance')
      
      // Mock one event within radius, one outside
      calculateDistance
        .mockReturnValueOnce(20) // Within 25 mile radius
        .mockReturnValueOnce(30) // Outside 25 mile radius

      const mockEvents = [
        {
          id: 'event-1',
          name: 'Near Event',
          time_start: '2024-07-15T19:00:00Z',
          location: { display_address: ['Near Location'] },
          latitude: 34.0522,
          longitude: -118.2437
        },
        {
          id: 'event-2', 
          name: 'Far Event',
          time_start: '2024-07-15T20:00:00Z',
          location: { display_address: ['Far Location'] },
          latitude: 34.1000,
          longitude: -118.3000
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: mockEvents, total: 2 }),
      } as Response)

      const result = await provider.searchEvents(mockSearchParams)

      expect(result.events).toHaveLength(1) // Only the near event
      expect(result.events[0].title).toBe('Near Event')
    })
  })

  describe('Event Transformation', () => {
    beforeEach(() => {
      const { geocodingService } = require('@/services/geocoding')
      const { calculateDistance } = require('@/utils/distance')
      
      geocodingService.geocodeZipCode.mockResolvedValue({
        coordinates: { latitude: 34.0522, longitude: -118.2437 }
      })
      calculateDistance.mockReturnValue(3.7)
    })

    it('should transform Yelp events to standard format', async () => {
      const mockYelpEvent = {
        id: 'yelp-789',
        name: 'Art Gallery Opening',
        description: 'Contemporary art showcase featuring local artists',
        time_start: '2024-07-20T18:00:00Z',
        is_free: true,
        category: 'arts_and_entertainment',
        interested_count: 89,
        attending_count: 23,
        location: {
          address1: '456 Art District Blvd',
          city: 'Los Angeles',
          state: 'CA',
          zip_code: '90013',
          display_address: ['456 Art District Blvd', 'Los Angeles, CA 90013']
        },
        latitude: 34.0522,
        longitude: -118.2437,
        business_id: 'gallery-business-123'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [mockYelpEvent],
          total: 1
        }),
      } as Response)

      const result = await provider.searchEvents({
        postalCode: '90210',
        radius: 25
      })

      const event = result.events[0]
      expect(event.id).toBe('yelp_yelp-789')
      expect(event.title).toBe('Art Gallery Opening')
      expect(event.address).toBe('456 Art District Blvd, Los Angeles, CA 90013')
      expect(event.category).toBe('Arts And Entertainment')
      expect(event.distance).toBe(3.7)
      expect(event.description).toContain('Contemporary art showcase')
      expect(event.description).toContain('Free admission')
      expect(event.description).toContain('89 interested')
    })

    it('should handle events with pricing information', async () => {
      const mockPaidEvent = {
        id: 'paid-event',
        name: 'Premium Workshop',
        time_start: '2024-07-25T14:00:00Z',
        is_free: false,
        cost: 50,
        cost_max: 75,
        location: { display_address: ['Workshop Location'] },
        latitude: 34.0522,
        longitude: -118.2437
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [mockPaidEvent],
          total: 1
        }),
      } as Response)

      const result = await provider.searchEvents({
        postalCode: '90210',
        radius: 25
      })

      expect(result.events[0].description).toContain('$50 - $75')
    })

    it('should extract venue names appropriately', async () => {
      const mockEventWithBusiness = {
        id: 'business-event',
        name: 'Business Event',
        time_start: '2024-07-30T12:00:00Z',
        business_id: 'some-business-id',
        location: { display_address: ['Business Location'] },
        latitude: 34.0522,
        longitude: -118.2437
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          events: [mockEventWithBusiness],
          total: 1
        }),
      } as Response)

      const result = await provider.searchEvents({
        postalCode: '90210',
        radius: 25
      })

      // Should use generic venue name when business_id is present
      expect(result.events[0].venue).toBe('Local Business Venue')
    })
  })

  describe('Mock Data', () => {
    it('should return consistent mock events', () => {
      const mockEvents = (provider as any).getMockYelpEvents({})
      
      expect(mockEvents).toHaveLength(3)
      expect(mockEvents[0].id).toBe('yelp_mock_1')
      expect(mockEvents[0].title).toContain('Art Gallery')
      expect(mockEvents[1].title).toContain('Farmers Market')
      expect(mockEvents[2].title).toContain('Wine Tasting')
      
      // All should have proper categories
      expect(mockEvents[0].category).toBe('Arts & Culture')
      expect(mockEvents[1].category).toBe('Community')
      expect(mockEvents[2].category).toBe('Food & Drink')
    })
  })
})