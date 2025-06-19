import { TicketmasterProvider } from '../ticketmasterProvider'
import type { EventSearchParams } from '@/types/eventProvider'

// Mock fetch
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('TicketmasterProvider', () => {
  let provider: TicketmasterProvider
  
  beforeEach(() => {
    provider = new TicketmasterProvider()
    mockFetch.mockClear()
  })

  describe('Provider Configuration', () => {
    it('should have correct name and priority', () => {
      expect(provider.name).toBe('Ticketmaster')
      expect(provider.priority).toBe(100)
    })

    it('should have all required capabilities', () => {
      expect(provider.capabilities).toEqual({
        locationSearch: true,
        categoryFilter: true,
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
      size: 20,
      page: 0
    }

    it('should make correct API call with required parameters', async () => {
      const mockResponse = {
        _embedded: {
          events: [
            {
              id: 'test-event-1',
              name: 'Test Concert',
              dates: {
                start: {
                  dateTime: '2024-07-01T19:00:00Z'
                }
              },
              _embedded: {
                venues: [{
                  id: 'venue-1',
                  name: 'Test Venue',
                  city: { name: 'Los Angeles' },
                  state: { stateCode: 'CA' },
                  postalCode: '90210',
                  address: { line1: '123 Test St' },
                  location: { latitude: '34.0522', longitude: '-118.2437' }
                }]
              },
              classifications: [{
                segment: { name: 'Music' },
                genre: { name: 'Rock' }
              }]
            }
          ]
        },
        page: {
          size: 20,
          totalElements: 1,
          totalPages: 1,
          number: 0
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await provider.searchEvents(mockSearchParams)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://app.ticketmaster.com/discovery/v2/events'),
        expect.objectContaining({
          headers: {
            'Accept': 'application/json'
          }
        })
      )

      expect(result.events).toHaveLength(1)
      expect(result.events[0].id).toBe('tm_test-event-1')
      expect(result.events[0].title).toBe('Test Concert')
      expect(result.source).toBe('Ticketmaster')
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response)

      const result = await provider.searchEvents(mockSearchParams)

      expect(result.events).toHaveLength(3) // Mock events
      expect(result.events[0].id).toBe('tm_mock_1')
      expect(result.source).toBe('Ticketmaster')
    })

    it('should handle rate limiting (429) with mock data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response)

      const result = await provider.searchEvents(mockSearchParams)

      expect(result.events).toHaveLength(3) // Mock events
      expect(result.events[0].id).toBe('tm_mock_1')
      expect(result.source).toBe('Ticketmaster')
    })

    it('should include date range parameters when provided', async () => {
      const paramsWithDates: EventSearchParams = {
        ...mockSearchParams,
        startDateTime: '2024-07-01T00:00:00Z',
        endDateTime: '2024-07-31T23:59:59Z'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ _embedded: { events: [] }, page: { size: 0, totalElements: 0, totalPages: 0, number: 0 } }),
      } as Response)

      await provider.searchEvents(paramsWithDates)

      const fetchCall = mockFetch.mock.calls[0]
      const url = fetchCall[0] as string
      
      expect(url).toContain('startDateTime=2024-07-01T00%3A00%3A00Z')
      expect(url).toContain('endDateTime=2024-07-31T23%3A59%3A59Z')
    })

    it('should include category mapping when provided', async () => {
      const paramsWithCategory: EventSearchParams = {
        ...mockSearchParams,
        category: 'music'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ _embedded: { events: [] }, page: { size: 0, totalElements: 0, totalPages: 0, number: 0 } }),
      } as Response)

      await provider.searchEvents(paramsWithCategory)

      const fetchCall = mockFetch.mock.calls[0]
      const url = fetchCall[0] as string
      
      expect(url).toContain('classificationName=Music')
    })
  })

  describe('Event Transformation', () => {
    it('should transform Ticketmaster events to standard format', async () => {
      const mockTMEvent = {
        id: 'tm-123',
        name: 'Rock Concert',
        dates: {
          start: {
            dateTime: '2024-07-15T20:00:00Z'
          }
        },
        _embedded: {
          venues: [{
            id: 'venue-456',
            name: 'Madison Square Garden',
            city: { name: 'New York' },
            state: { stateCode: 'NY' },
            postalCode: '10001',
            address: { line1: '4 Pennsylvania Plaza' },
            location: { latitude: '40.7505', longitude: '-73.9934' }
          }]
        },
        classifications: [{
          segment: { name: 'Music' },
          genre: { name: 'Rock' }
        }]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          _embedded: { events: [mockTMEvent] },
          page: { size: 1, totalElements: 1, totalPages: 1, number: 0 }
        }),
      } as Response)

      const result = await provider.searchEvents({
        postalCode: '10001',
        radius: 25
      })

      const event = result.events[0]
      expect(event.id).toBe('tm_tm-123')
      expect(event.title).toBe('Rock Concert')
      expect(event.venue).toBe('Madison Square Garden')
      expect(event.category).toBe('Rock')
      expect(event.address).toContain('4 Pennsylvania Plaza')
    })
  })

  describe('Mock Data', () => {
    it('should return consistent mock data', () => {
      const mockEvents = (provider as any).getMockTicketmasterEvents()
      
      expect(mockEvents).toHaveLength(3)
      expect(mockEvents[0].id).toBe('tm_mock_1')
      expect(mockEvents[0].title).toContain('Lakers')
      expect(mockEvents[1].title).toContain('Imagine Dragons')
      expect(mockEvents[2].title).toContain('Lion King')
    })
  })
})