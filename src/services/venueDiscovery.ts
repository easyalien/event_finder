import type { Venue, VenueSearchParams, VenueSearchResult } from '@/types/venue'
import { oauthManager } from '@/services/oauth/oauthManager'
import { FoursquareOAuthProvider } from '@/services/oauth/providers/foursquareOAuth'

interface FoursquareVenue {
  fsq_id: string
  name: string
  location: {
    address?: string
    locality?: string
    region?: string
    postcode?: string
    country?: string
    formatted_address: string
  }
  geocodes: {
    main: {
      latitude: number
      longitude: number
    }
  }
  categories: Array<{
    id: number
    name: string
    icon: {
      prefix: string
      suffix: string
    }
  }>
  distance?: number
  tel?: string
  website?: string
}

interface FoursquareResponse {
  results: FoursquareVenue[]
  context: {
    geo_bounds: {
      circle: {
        center: {
          latitude: number
          longitude: number
        }
        radius: number
      }
    }
  }
}

export class VenueDiscoveryService {
  private readonly baseUrl = 'https://api.foursquare.com/v3'
  private foursquareProvider: FoursquareOAuthProvider

  constructor() {
    this.foursquareProvider = new FoursquareOAuthProvider()
    oauthManager.registerProvider(this.foursquareProvider)
  }

  // Foursquare category IDs for venues that typically host events
  private readonly eventVenueCategories = [
    '10027', // Theater
    '10028', // Concert Hall
    '10029', // Music Venue
    '10030', // Stadium
    '10031', // Sports Complex
    '10032', // Race Track
    '10033', // Golf Course
    '10034', // Convention Center
    '10035', // Exhibition Hall
    '10036', // Conference Room
    '16006', // Gallery
    '16007', // Museum
    '13003', // Hotel
    '13006', // Event Space
    '13065', // Banquet Hall
    '13066', // Wedding Hall
    '13334', // Community Center
    '13335', // Library
    '13336', // School
    '13337', // University
    '10001', // Arts & Entertainment (general)
    '13000'  // Event Services (general)
  ]

  async searchVenues(params: VenueSearchParams): Promise<VenueSearchResult> {
    const token = oauthManager.getToken('foursquare')
    
    if (!token) {
      throw new Error('Foursquare OAuth token not available. Please connect your account.')
    }

    const searchParams = new URLSearchParams({
      ll: `${params.latitude},${params.longitude}`,
      radius: params.radius.toString(),
      categories: this.eventVenueCategories.join(','),
      limit: (params.limit || 50).toString(),
      fields: 'fsq_id,name,location,geocodes,categories,distance,tel,website'
    })

    try {
      const response = await this.foursquareProvider.makeAuthenticatedRequest(
        `${this.baseUrl}/places/search?${searchParams}`,
        token
      )

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Foursquare authentication expired. Please reconnect your account.')
        }
        throw new Error(`Foursquare API error: ${response.status} ${response.statusText}`)
      }

      const data: FoursquareResponse = await response.json()
      
      const venues = data.results.map(this.transformVenue)
      
      return {
        venues,
        totalCount: venues.length,
        source: 'foursquare'
      }
    } catch (error) {
      console.error('Error fetching venues from Foursquare:', error)
      throw error
    }
  }

  isAvailable(): boolean {
    return oauthManager.isConnected('foursquare')
  }

  getConnectionUrl(): string {
    return oauthManager.getAuthUrl('foursquare', '/events')
  }

  private transformVenue = (fsqVenue: FoursquareVenue): Venue => {
    const primaryCategory = fsqVenue.categories?.[0]
    
    return {
      id: fsqVenue.fsq_id,
      name: fsqVenue.name,
      address: fsqVenue.location.formatted_address,
      latitude: fsqVenue.geocodes.main.latitude,
      longitude: fsqVenue.geocodes.main.longitude,
      category: primaryCategory?.name || 'Event Venue',
      distance: fsqVenue.distance,
      source: 'foursquare',
      externalIds: {
        foursquareId: fsqVenue.fsq_id
      },
      metadata: {
        phone: fsqVenue.tel,
        website: fsqVenue.website,
        description: `${primaryCategory?.name || 'Event'} venue in ${fsqVenue.location.locality || 'the area'}`
      }
    }
  }

  // Helper method to get venue details if needed
  async getVenueDetails(venueId: string): Promise<FoursquareVenue | null> {
    const token = oauthManager.getToken('foursquare')
    
    if (!token) {
      return null
    }

    try {
      const response = await this.foursquareProvider.makeAuthenticatedRequest(
        `${this.baseUrl}/places/${venueId}`,
        token
      )

      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching venue details:', error)
      return null
    }
  }
}

export const venueDiscoveryService = new VenueDiscoveryService()