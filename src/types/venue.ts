export interface Venue {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  category: string
  distance?: number
  source: 'foursquare' | 'eventbrite' | 'other'
  externalIds?: {
    foursquareId?: string
    eventbriteId?: string
  }
  metadata?: {
    phone?: string
    website?: string
    description?: string
    capacity?: number
  }
}

export interface VenueSearchParams {
  latitude: number
  longitude: number
  radius: number // in meters
  categories?: string[]
  limit?: number
}

export interface VenueSearchResult {
  venues: Venue[]
  totalCount: number
  source: string
}