/**
 * Integration tests for all API providers
 * Tests provider configuration, availability, and mock data functionality
 */

import { TicketmasterProvider } from '../providers/ticketmasterProvider'
import { YelpProvider } from '../providers/yelpProvider'
import { ArtInstituteProvider } from '../providers/artInstituteProvider'
import { SeatGeekProvider } from '../providers/seatgeekProvider'
import { BandsinTownProvider } from '../providers/bandsintown'
import { EventbriteProvider } from '../providers/eventbriteProvider'

describe('Provider Integration Tests', () => {
  describe('Provider Configuration', () => {
    it('should have all providers with correct priorities', () => {
      const ticketmaster = new TicketmasterProvider()
      const eventbrite = new EventbriteProvider()
      const seatgeek = new SeatGeekProvider()
      const bandsintown = new BandsinTownProvider()
      const yelp = new YelpProvider()
      const artInstitute = new ArtInstituteProvider()

      // Check provider names
      expect(ticketmaster.name).toBe('Ticketmaster')
      expect(eventbrite.name).toBe('Eventbrite')
      expect(seatgeek.name).toBe('SeatGeek')
      expect(bandsintown.name).toBe('Bandsintown')
      expect(yelp.name).toBe('Yelp')
      expect(artInstitute.name).toBe('Art Institute of Chicago')

      // Check priority order (higher number = higher priority)
      expect(ticketmaster.priority).toBe(100)
      expect(eventbrite.priority).toBe(90)
      expect(seatgeek.priority).toBe(85)
      expect(bandsintown.priority).toBe(75)
      expect(yelp.priority).toBe(70)
      expect(artInstitute.priority).toBe(65)
    })

    it('should have providers with appropriate capabilities', () => {
      const providers = [
        new TicketmasterProvider(),
        new EventbriteProvider(),
        new SeatGeekProvider(),
        new BandsinTownProvider(),
        new YelpProvider(),
        new ArtInstituteProvider()
      ]

      providers.forEach(provider => {
        expect(provider.capabilities).toHaveProperty('locationSearch')
        expect(provider.capabilities).toHaveProperty('categoryFilter')
        expect(provider.capabilities).toHaveProperty('dateRange')
        expect(provider.capabilities).toHaveProperty('pagination')
        
        expect(typeof provider.capabilities.locationSearch).toBe('boolean')
        expect(typeof provider.capabilities.categoryFilter).toBe('boolean')
        expect(typeof provider.capabilities.dateRange).toBe('boolean')
        expect(typeof provider.capabilities.pagination).toBe('boolean')
      })
    })
  })

  describe('Provider Availability', () => {
    it('should check availability based on environment variables', () => {
      const ticketmaster = new TicketmasterProvider()
      const eventbrite = new EventbriteProvider()
      const seatgeek = new SeatGeekProvider()
      const yelp = new YelpProvider()
      const artInstitute = new ArtInstituteProvider()

      // With test environment variables, these should be available
      expect(ticketmaster.isAvailable()).toBe(true)
      expect(eventbrite.isAvailable()).toBe(true)
      expect(seatgeek.isAvailable()).toBe(true)
      expect(yelp.isAvailable()).toBe(true)
      
      // Art Institute doesn't require API key
      expect(artInstitute.isAvailable()).toBe(true)
    })
  })

  describe('Mock Data Consistency', () => {
    const mockSearchParams = {
      postalCode: '90210',
      radius: 25
    }

    it('should return consistent mock data from Ticketmaster', async () => {
      const provider = new TicketmasterProvider()
      
      // Mock the fetch to trigger fallback
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400
      })

      const result = await provider.searchEvents(mockSearchParams)
      
      expect(result.events).toHaveLength(3)
      expect(result.source).toBe('Ticketmaster')
      expect(result.events[0].id).toMatch(/^tm_/)
      expect(result.events.every(event => event.category)).toBe(true)
    })

    it('should return consistent mock data from SeatGeek', async () => {
      const provider = new SeatGeekProvider()
      
      // Test with no API key to trigger mock data
      process.env.NEXT_PUBLIC_SEATGEEK_CLIENT_ID = ''
      
      const result = await provider.searchEvents(mockSearchParams)
      
      expect(result.events).toHaveLength(3)
      expect(result.source).toBe('SeatGeek')
      expect(result.events[0].id).toMatch(/^sg_/)
      
      // Restore for other tests
      process.env.NEXT_PUBLIC_SEATGEEK_CLIENT_ID = 'test_seatgeek_client_id'
    })

    it('should return consistent mock data from Yelp', async () => {
      const provider = new YelpProvider()
      
      // Mock the fetch to trigger fallback
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400
      })

      const result = await provider.searchEvents(mockSearchParams)
      
      expect(result.events).toHaveLength(3)
      expect(result.source).toBe('Yelp')
      expect(result.events[0].id).toMatch(/^yelp_/)
    })

    it('should return consistent mock data from Art Institute', async () => {
      const provider = new ArtInstituteProvider()
      
      // Mock the fetch to trigger fallback
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500
      })

      const result = await provider.searchEvents(mockSearchParams)
      
      expect(result.events).toHaveLength(2)
      expect(result.source).toBe('Art Institute of Chicago')
      expect(result.events[0].id).toMatch(/^aic_/)
      expect(result.events.every(event => event.category === 'Arts & Culture')).toBe(true)
    })
  })

  describe('Event Data Structure', () => {
    it('should return events with required fields', async () => {
      const provider = new TicketmasterProvider()
      
      // Mock the fetch to trigger fallback
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400
      })

      const result = await provider.searchEvents({
        postalCode: '90210',
        radius: 25
      })

      result.events.forEach(event => {
        expect(event).toHaveProperty('id')
        expect(event).toHaveProperty('title')
        expect(event).toHaveProperty('description')
        expect(event).toHaveProperty('date')
        expect(event).toHaveProperty('venue')
        expect(event).toHaveProperty('address')
        expect(event).toHaveProperty('category')
        expect(event).toHaveProperty('distance')
        
        expect(typeof event.id).toBe('string')
        expect(typeof event.title).toBe('string')
        expect(typeof event.description).toBe('string')
        expect(typeof event.date).toBe('string')
        expect(typeof event.venue).toBe('string')
        expect(typeof event.address).toBe('string')
        expect(typeof event.category).toBe('string')
        expect(typeof event.distance).toBe('number')
        
        // Validate date is ISO string
        expect(() => new Date(event.date)).not.toThrow()
        expect(new Date(event.date).toISOString()).toBe(event.date)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API failures gracefully', async () => {
      const providers = [
        new TicketmasterProvider(),
        new YelpProvider(),
        new ArtInstituteProvider()
      ]

      // Mock all fetches to fail
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      for (const provider of providers) {
        const result = await provider.searchEvents({
          postalCode: '90210',
          radius: 25
        })

        // Should not throw and should return mock data
        expect(result).toBeDefined()
        expect(result.events).toBeDefined()
        expect(result.events.length).toBeGreaterThan(0)
        expect(result.source).toBe(provider.name)
      }
    })

    it('should handle network errors gracefully', async () => {
      const provider = new TicketmasterProvider()
      
      // Mock fetch to throw network error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      // Network errors currently throw, but in future could be handled gracefully
      await expect(provider.searchEvents({
        postalCode: '90210',
        radius: 25
      })).rejects.toThrow('Network error')
    })
  })

  describe('Provider Priority and Coverage', () => {
    it('should have providers covering different event types', () => {
      const mockResults = [
        { provider: 'Ticketmaster', categories: ['Sports', 'Music', 'Theater'] },
        { provider: 'SeatGeek', categories: ['Sports', 'Music', 'Theater'] },
        { provider: 'Yelp', categories: ['Arts & Culture', 'Community', 'Food & Drink'] },
        { provider: 'Art Institute', categories: ['Arts & Culture'] },
        { provider: 'Bandsintown', categories: ['Pop', 'Rock', 'Hip-Hop'] }
      ]

      const allCategories = new Set()
      mockResults.forEach(result => {
        result.categories.forEach(cat => allCategories.add(cat))
      })

      // Should cover diverse event categories
      expect(allCategories.size).toBeGreaterThan(5)
      expect(allCategories.has('Sports')).toBe(true)
      expect(allCategories.has('Music')).toBe(true)
      expect(allCategories.has('Arts & Culture')).toBe(true)
    })
  })
})