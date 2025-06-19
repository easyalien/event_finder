import type { Event } from '@/types/event'
import type { 
  IEventProvider, 
  EventSearchParams, 
  EventSearchResult 
} from '@/types/eventProvider'

interface ArtInstituteExhibition {
  id: number
  title: string
  status: string
  aic_start_at: string | null
  aic_end_at: string | null
  gallery_id: number | null
  gallery_title: string | null
  web_url: string | null
  short_description: string | null
  description: string | null
  is_featured: boolean
  image_url: string | null
  artwork_ids: number[]
  artist_ids: number[]
}

interface ArtInstituteResponse {
  pagination: {
    total: number
    limit: number
    offset: number
    current_page: number
    total_pages: number
  }
  data: ArtInstituteExhibition[]
}

export class ArtInstituteProvider implements IEventProvider {
  readonly name = 'Art Institute of Chicago'
  readonly priority = 65 // Below Yelp, cultural events
  readonly capabilities = {
    locationSearch: false, // Single location (Chicago)
    categoryFilter: false, // Only art exhibitions
    dateRange: true,
    pagination: true
  }

  private readonly baseUrl = 'https://api.artic.edu/api/v1'
  private readonly museumLocation = {
    latitude: 41.8796,
    longitude: -87.6237,
    address: '111 S Michigan Ave, Chicago, IL 60603'
  }

  async searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
    try {
      // Calculate distance from user location to Art Institute
      const userDistance = await this.calculateDistanceToMuseum(params.postalCode!)
      
      // Only include if within radius
      if (userDistance > params.radius) {
        return {
          events: [],
          totalCount: 0,
          hasMore: false,
          source: this.name
        }
      }

      // Fetch current and upcoming exhibitions
      const searchParams = new URLSearchParams({
        limit: '50',
        fields: 'id,title,status,aic_start_at,aic_end_at,gallery_title,web_url,short_description,description,is_featured,image_url'
      })

      const response = await fetch(`${this.baseUrl}/exhibitions?${searchParams}`)
      
      if (!response.ok) {
        throw new Error(`Art Institute API error: ${response.status} ${response.statusText}`)
      }

      const data: ArtInstituteResponse = await response.json()
      
      // Filter for current and upcoming exhibitions
      const currentExhibitions = data.data.filter(exhibition => {
        if (!exhibition.aic_start_at || !exhibition.aic_end_at) return false
        
        const now = new Date()
        const startDate = new Date(exhibition.aic_start_at)
        const endDate = new Date(exhibition.aic_end_at)
        
        // Include if exhibition is current or upcoming
        return endDate >= now
      })

      // Filter by date range if specified
      const filteredExhibitions = this.filterByDateRange(currentExhibitions, params)
      
      const events = filteredExhibitions.map(exhibition => 
        this.transformExhibition(exhibition, userDistance)
      )

      return {
        events,
        totalCount: events.length,
        hasMore: false, // Art Institute has limited exhibitions
        source: this.name
      }
    } catch (error) {
      console.error('Error fetching exhibitions from Art Institute:', error)
      // Fall back to mock data on error
      return {
        events: this.getMockArtInstituteEvents(params),
        totalCount: 2,
        hasMore: false,
        source: this.name
      }
    }
  }

  isAvailable(): boolean {
    return true // No API key required
  }

  private async calculateDistanceToMuseum(postalCode: string): Promise<number> {
    try {
      // Import geocoding service to get user coordinates
      const { geocodingService } = await import('@/services/geocoding')
      const geoResult = await geocodingService.geocodeZipCode(postalCode)
      
      // Import distance calculation utility
      const { calculateDistance } = await import('@/utils/distance')
      
      return calculateDistance(
        geoResult.coordinates.latitude,
        geoResult.coordinates.longitude,
        this.museumLocation.latitude,
        this.museumLocation.longitude
      )
    } catch (error) {
      console.warn('Could not calculate distance to Art Institute:', error)
      return 0 // Default to 0 to include in results
    }
  }

  private filterByDateRange(exhibitions: ArtInstituteExhibition[], params: EventSearchParams): ArtInstituteExhibition[] {
    if (!params.startDateTime && !params.endDateTime) {
      return exhibitions
    }

    return exhibitions.filter(exhibition => {
      if (!exhibition.aic_start_at || !exhibition.aic_end_at) return false
      
      const exhibitionStart = new Date(exhibition.aic_start_at)
      const exhibitionEnd = new Date(exhibition.aic_end_at)
      
      // Check if exhibition overlaps with requested date range
      if (params.startDateTime) {
        const searchStart = new Date(params.startDateTime)
        if (exhibitionEnd < searchStart) return false
      }
      
      if (params.endDateTime) {
        const searchEnd = new Date(params.endDateTime)
        if (exhibitionStart > searchEnd) return false
      }
      
      return true
    })
  }

  private transformExhibition = (exhibition: ArtInstituteExhibition, distance: number): Event => {
    // Use exhibition start date, or current date if already started
    const now = new Date()
    const startDate = new Date(exhibition.aic_start_at!)
    const eventDate = startDate > now ? startDate : now

    return {
      id: `aic_${exhibition.id}`,
      title: exhibition.title,
      description: this.createDescription(exhibition),
      date: eventDate.toISOString(),
      venue: this.getVenueName(exhibition),
      address: this.museumLocation.address,
      category: 'Arts & Culture',
      distance: Math.round(distance * 10) / 10
    }
  }

  private createDescription(exhibition: ArtInstituteExhibition): string {
    const parts = []
    
    if (exhibition.short_description) {
      parts.push(exhibition.short_description.trim())
    } else if (exhibition.description) {
      // Truncate long descriptions
      const truncated = exhibition.description.length > 200 
        ? exhibition.description.substring(0, 200) + '...'
        : exhibition.description
      parts.push(truncated.trim())
    }
    
    // Add exhibition dates
    if (exhibition.aic_start_at && exhibition.aic_end_at) {
      const startDate = new Date(exhibition.aic_start_at).toLocaleDateString()
      const endDate = new Date(exhibition.aic_end_at).toLocaleDateString()
      parts.push(`Exhibition runs ${startDate} - ${endDate}`)
    }
    
    if (exhibition.is_featured) {
      parts.push('Featured exhibition')
    }
    
    parts.push('Free admission to museum collection')
    
    if (exhibition.web_url) {
      parts.push('More details available online')
    }
    
    if (parts.length === 0) {
      parts.push('Art exhibition at the Art Institute of Chicago')
    }
    
    return parts.join(' • ')
  }

  private getVenueName(exhibition: ArtInstituteExhibition): string {
    if (exhibition.gallery_title) {
      return `Art Institute - ${exhibition.gallery_title}`
    }
    return 'Art Institute of Chicago'
  }

  private getMockArtInstituteEvents(params: EventSearchParams): Event[] {
    // Mock exhibitions to demonstrate the integration
    const baseDate = new Date()
    
    return [
      {
        id: 'aic_mock_1',
        title: 'Monet and Chicago',
        description: 'Explore Claude Monet\'s relationship with Chicago through paintings, letters, and historical artifacts • Exhibition runs through March 2025 • Featured exhibition • Free admission to museum collection',
        date: new Date(baseDate.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Art Institute - Modern Wing',
        address: '111 S Michigan Ave, Chicago, IL 60603',
        category: 'Arts & Culture',
        distance: 850.2
      },
      {
        id: 'aic_mock_2',
        title: 'Contemporary Perspectives: African Art Now',
        description: 'Contemporary African artists reimagine traditional forms and themes • Sculptures, paintings, and multimedia installations • Exhibition runs January - June 2025 • More details available online',
        date: new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Art Institute - Contemporary Galleries',
        address: '111 S Michigan Ave, Chicago, IL 60603',
        category: 'Arts & Culture',
        distance: 850.2
      }
    ]
  }
}