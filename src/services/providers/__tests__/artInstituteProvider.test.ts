import { ArtInstituteProvider } from '../artInstituteProvider'
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

describe('ArtInstituteProvider', () => {
  let provider: ArtInstituteProvider
  
  beforeEach(() => {
    provider = new ArtInstituteProvider()
    mockFetch.mockClear()
  })

  describe('Provider Configuration', () => {
    it('should have correct name and priority', () => {
      expect(provider.name).toBe('Art Institute of Chicago')
      expect(provider.priority).toBe(65)
    })

    it('should have appropriate capabilities for museum exhibitions', () => {
      expect(provider.capabilities).toEqual({
        locationSearch: false, // Single location (Chicago)
        categoryFilter: false, // Only art exhibitions
        dateRange: true,
        pagination: true
      })
    })

    it('should always be available (no API key required)', () => {
      expect(provider.isAvailable()).toBe(true)
    })
  })

  describe('Location-based Filtering', () => {
    const mockSearchParams: EventSearchParams = {
      postalCode: '60601', // Chicago ZIP
      radius: 25
    }

    beforeEach(() => {
      // Mock geocoding to return Chicago coordinates
      const { geocodingService } = require('@/services/geocoding')
      geocodingService.geocodeZipCode.mockResolvedValue({
        coordinates: { latitude: 41.8781, longitude: -87.6298 }
      })

      // Mock distance calculation to return 2 miles (within radius)
      const { calculateDistance } = require('@/utils/distance')
      calculateDistance.mockReturnValue(2.0)
    })

    it('should include exhibitions when user is within radius', async () => {
      const mockExhibition = {
        id: 123,
        title: 'Van Gogh Exhibition',
        status: 'Open',
        aic_start_at: '2024-01-01T00:00:00Z',
        aic_end_at: '2024-12-31T23:59:59Z',
        gallery_title: 'Modern Wing',
        short_description: 'Masterpieces by Vincent van Gogh',
        is_featured: true,
        web_url: 'https://www.artic.edu/exhibitions/van-gogh'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [mockExhibition],
          pagination: { total: 1 }
        }),
      } as Response)

      const result = await provider.searchEvents(mockSearchParams)

      expect(result.events).toHaveLength(1)
      expect(result.events[0].id).toBe('aic_123')
      expect(result.events[0].title).toBe('Van Gogh Exhibition')
      expect(result.events[0].category).toBe('Arts & Culture')
      expect(result.source).toBe('Art Institute of Chicago')
    })

    it('should exclude exhibitions when user is outside radius', async () => {
      // Mock distance calculation to return 100 miles (outside radius)
      const { calculateDistance } = require('@/utils/distance')
      calculateDistance.mockReturnValue(100.0)

      const result = await provider.searchEvents(mockSearchParams)

      expect(result.events).toHaveLength(0)
      expect(result.totalCount).toBe(0)
    })
  })

  describe('API Integration', () => {
    beforeEach(() => {
      // Setup mocks for within-radius scenario
      const { geocodingService } = require('@/services/geocoding')
      const { calculateDistance } = require('@/utils/distance')
      
      geocodingService.geocodeZipCode.mockResolvedValue({
        coordinates: { latitude: 41.8781, longitude: -87.6298 }
      })
      calculateDistance.mockReturnValue(2.0)
    })

    it('should make correct API call to Art Institute', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], pagination: { total: 0 } }),
      } as Response)

      await provider.searchEvents({ postalCode: '60601', radius: 25 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.artic.edu/api/v1/exhibitions'),
        undefined
      )

      const fetchCall = mockFetch.mock.calls[0]
      const url = fetchCall[0] as string
      
      expect(url).toContain('limit=50')
      expect(url).toContain('fields=id,title,status,aic_start_at,aic_end_at')
    })

    it('should filter exhibitions by date range', async () => {
      const futureExhibition = {
        id: 1,
        title: 'Future Exhibition',
        aic_start_at: '2025-01-01T00:00:00Z',
        aic_end_at: '2025-06-30T23:59:59Z',
        gallery_title: 'Gallery 1'
      }

      const pastExhibition = {
        id: 2,
        title: 'Past Exhibition',
        aic_start_at: '2023-01-01T00:00:00Z',
        aic_end_at: '2023-06-30T23:59:59Z',
        gallery_title: 'Gallery 2'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [futureExhibition, pastExhibition],
          pagination: { total: 2 }
        }),
      } as Response)

      const result = await provider.searchEvents({
        postalCode: '60601',
        radius: 25
      })

      // Should only include future exhibition (past ones are filtered out)
      expect(result.events).toHaveLength(1)
      expect(result.events[0].title).toBe('Future Exhibition')
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)

      const result = await provider.searchEvents({
        postalCode: '60601',
        radius: 25
      })

      expect(result.events).toHaveLength(2) // Mock exhibitions
      expect(result.events[0].id).toBe('aic_mock_1')
      expect(result.source).toBe('Art Institute of Chicago')
    })
  })

  describe('Exhibition Transformation', () => {
    beforeEach(() => {
      const { geocodingService } = require('@/services/geocoding')
      const { calculateDistance } = require('@/utils/distance')
      
      geocodingService.geocodeZipCode.mockResolvedValue({
        coordinates: { latitude: 41.8781, longitude: -87.6298 }
      })
      calculateDistance.mockReturnValue(1.5)
    })

    it('should transform exhibitions to standard event format', async () => {
      const mockExhibition = {
        id: 456,
        title: 'Contemporary Art Now',
        aic_start_at: '2024-06-01T00:00:00Z',
        aic_end_at: '2024-09-30T23:59:59Z',
        gallery_title: 'Contemporary Wing',
        short_description: 'Modern art from emerging artists',
        is_featured: false,
        web_url: 'https://www.artic.edu/exhibitions/contemporary'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [mockExhibition],
          pagination: { total: 1 }
        }),
      } as Response)

      const result = await provider.searchEvents({
        postalCode: '60601',
        radius: 25
      })

      const event = result.events[0]
      expect(event.id).toBe('aic_456')
      expect(event.title).toBe('Contemporary Art Now')
      expect(event.venue).toBe('Art Institute - Contemporary Wing')
      expect(event.category).toBe('Arts & Culture')
      expect(event.address).toBe('111 S Michigan Ave, Chicago, IL 60603')
      expect(event.distance).toBe(1.5)
      expect(event.description).toContain('Modern art from emerging artists')
      expect(event.description).toContain('Exhibition runs')
    })

    it('should handle exhibitions without gallery titles', async () => {
      const mockExhibition = {
        id: 789,
        title: 'Special Exhibition',
        aic_start_at: '2024-07-01T00:00:00Z',
        aic_end_at: '2024-08-31T23:59:59Z',
        gallery_title: null,
        short_description: 'A special temporary exhibition'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [mockExhibition],
          pagination: { total: 1 }
        }),
      } as Response)

      const result = await provider.searchEvents({
        postalCode: '60601',
        radius: 25
      })

      expect(result.events[0].venue).toBe('Art Institute of Chicago')
    })
  })

  describe('Mock Data', () => {
    it('should return consistent mock exhibitions', () => {
      const mockEvents = (provider as any).getMockArtInstituteEvents({})
      
      expect(mockEvents).toHaveLength(2)
      expect(mockEvents[0].id).toBe('aic_mock_1')
      expect(mockEvents[0].title).toContain('Monet')
      expect(mockEvents[1].title).toContain('Contemporary Perspectives')
      
      // All should be Arts & Culture category
      mockEvents.forEach(event => {
        expect(event.category).toBe('Arts & Culture')
        expect(event.address).toBe('111 S Michigan Ave, Chicago, IL 60603')
      })
    })
  })
})