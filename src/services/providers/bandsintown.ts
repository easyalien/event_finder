import type { Event } from '@/types/event'
import type { 
  IEventProvider, 
  EventSearchParams, 
  EventSearchResult 
} from '@/types/eventProvider'
import { spotifyService, type ArtistInfo } from '@/services/spotify'
import { calculateDistance } from '@/utils/distance'
import { geocodingService } from '@/services/geocoding'

interface BandsintownEvent {
  id: string
  artist_id: string
  url: string
  on_sale_datetime: string
  datetime: string
  description: string
  venue: {
    name: string
    type: string
    city: string
    region: string
    country: string
    latitude: string
    longitude: string
  }
  offers: Array<{
    type: string
    url: string
    status: string
  }>
  lineup: string[]
}

export class BandsinTownProvider implements IEventProvider {
  readonly name = 'Bandsintown'
  readonly priority = 75 // Between SeatGeek and Meetup
  readonly capabilities = {
    locationSearch: true, // Via artist discovery + location filtering
    categoryFilter: true, // Via music genres
    dateRange: true,
    pagination: false // We control pagination through artist selection
  }

  private readonly baseUrl = 'https://rest.bandsintown.com'
  private readonly appId = process.env.NEXT_PUBLIC_BANDSINTOWN_APP_ID

  async searchEvents(params: EventSearchParams): Promise<EventSearchResult> {
    if (!this.isAvailable()) {
      console.warn('Bandsintown provider using mock data. App ID not configured.')
      return {
        events: this.getMockBandsinTownEvents(params),
        totalCount: 3,
        hasMore: false,
        source: this.name
      }
    }

    try {
      // Step 1: Get user's location coordinates for distance calculation
      const geoResult = await geocodingService.geocodeZipCode(params.postalCode!)
      const userLat = geoResult.coordinates.latitude
      const userLon = geoResult.coordinates.longitude

      // Step 2: Get relevant artists from Spotify based on location/preferences
      const artists = await this.getRelevantArtists(params)
      
      if (artists.length === 0) {
        console.warn('No artists found for location, falling back to mock data')
        return {
          events: this.getMockBandsinTownEvents(params),
          totalCount: 3,
          hasMore: false,
          source: this.name
        }
      }

      // Step 3: Get events for each artist
      const allEvents: Event[] = []
      const maxArtistsToQuery = 20 // Limit to prevent too many API calls

      for (const artist of artists.slice(0, maxArtistsToQuery)) {
        try {
          const artistEvents = await this.getEventsForArtist(artist.name)
          
          // Filter events by location and date
          const filteredEvents = artistEvents.filter(event => {
            // Check distance
            if (event.venue.latitude && event.venue.longitude) {
              const distance = calculateDistance(
                userLat,
                userLon,
                parseFloat(event.venue.latitude),
                parseFloat(event.venue.longitude)
              )
              if (distance > params.radius) {
                return false
              }
            }

            // Check date range
            if (params.startDateTime) {
              const eventDate = new Date(event.datetime)
              const startDate = new Date(params.startDateTime)
              if (eventDate < startDate) {
                return false
              }
            }

            if (params.endDateTime) {
              const eventDate = new Date(event.datetime)
              const endDate = new Date(params.endDateTime)
              if (eventDate > endDate) {
                return false
              }
            }

            return true
          })

          const transformedEvents = filteredEvents.map(event => 
            this.transformEvent(event, artist, userLat, userLon)
          )
          
          allEvents.push(...transformedEvents)
        } catch (error) {
          console.warn(`Failed to get events for artist ${artist.name}:`, error)
          // Continue with next artist
        }
      }

      // Remove duplicates and sort by date
      const uniqueEvents = this.removeDuplicateEvents(allEvents)
      const sortedEvents = uniqueEvents.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      return {
        events: sortedEvents,
        totalCount: sortedEvents.length,
        hasMore: false,
        source: this.name
      }
    } catch (error) {
      console.error('Error in Bandsintown provider:', error)
      // Fall back to mock data on error
      return {
        events: this.getMockBandsinTownEvents(params),
        totalCount: 3,
        hasMore: false,
        source: this.name
      }
    }
  }

  isAvailable(): boolean {
    return !!(this.appId && spotifyService.isAvailable())
  }

  private async getRelevantArtists(params: EventSearchParams): Promise<ArtistInfo[]> {
    try {
      // Use Spotify to discover popular artists
      // In a more sophisticated implementation, we could:
      // 1. Use user's Spotify listening history (requires user OAuth)
      // 2. Get popular artists in the user's location
      // 3. Filter by music genres based on params.category
      
      if (params.category) {
        // Map event category to music genres
        const genreMapping: Record<string, string> = {
          'music': 'pop',
          'rock': 'rock',
          'pop': 'pop',
          'hip-hop': 'hip-hop',
          'country': 'country',
          'electronic': 'electronic',
          'jazz': 'jazz',
          'classical': 'classical'
        }
        
        const genre = genreMapping[params.category.toLowerCase()]
        if (genre) {
          return await spotifyService.searchArtistsByGenre(genre, 30)
        }
      }
      
      // Get general popular artists for the location
      return await spotifyService.getArtistsForLocation(params.postalCode!, 30)
    } catch (error) {
      console.error('Failed to get relevant artists from Spotify:', error)
      return []
    }
  }

  private async getEventsForArtist(artistName: string): Promise<BandsintownEvent[]> {
    const encodedArtist = encodeURIComponent(artistName)
    const url = `${this.baseUrl}/artists/${encodedArtist}/events?app_id=${this.appId}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      if (response.status === 404) {
        // Artist not found or no events - this is normal
        return []
      }
      throw new Error(`Bandsintown API error: ${response.status} ${response.statusText}`)
    }
    
    const events: BandsintownEvent[] = await response.json()
    return Array.isArray(events) ? events : []
  }

  private transformEvent = (
    btEvent: BandsintownEvent, 
    artist: ArtistInfo,
    userLat: number,
    userLon: number
  ): Event => {
    const distance = btEvent.venue.latitude && btEvent.venue.longitude
      ? calculateDistance(
          userLat,
          userLon,
          parseFloat(btEvent.venue.latitude),
          parseFloat(btEvent.venue.longitude)
        )
      : 0

    return {
      id: `bt_${btEvent.id}`,
      title: `${artist.name} Live`,
      description: this.createDescription(btEvent, artist),
      date: btEvent.datetime,
      venue: btEvent.venue.name,
      address: this.formatAddress(btEvent.venue),
      category: this.getCategoryFromGenres(artist.genres),
      distance: Math.round(distance * 10) / 10 // Round to 1 decimal place
    }
  }

  private createDescription(btEvent: BandsintownEvent, artist: ArtistInfo): string {
    const parts = []
    
    if (btEvent.description && btEvent.description.trim()) {
      parts.push(btEvent.description.trim())
    } else {
      parts.push(`Live concert featuring ${artist.name}`)
    }
    
    if (btEvent.lineup && btEvent.lineup.length > 1) {
      const otherArtists = btEvent.lineup.filter(name => name !== artist.name)
      if (otherArtists.length > 0) {
        parts.push(`Also featuring: ${otherArtists.slice(0, 2).join(', ')}`)
      }
    }
    
    if (artist.genres && artist.genres.length > 0) {
      parts.push(`Genre: ${artist.genres.slice(0, 2).join(', ')}`)
    }
    
    if (btEvent.offers && btEvent.offers.length > 0) {
      const ticketOffer = btEvent.offers.find(offer => offer.type === 'Tickets')
      if (ticketOffer && ticketOffer.status === 'available') {
        parts.push('Tickets available')
      }
    }
    
    return parts.join(' • ')
  }

  private formatAddress(venue: BandsintownEvent['venue']): string {
    const parts = [venue.city, venue.region, venue.country]
      .filter(Boolean)
    
    return parts.join(', ')
  }

  private getCategoryFromGenres(genres: string[]): string {
    if (!genres || genres.length === 0) return 'Music'
    
    // Map Spotify genres to our event categories
    const genre = genres[0].toLowerCase()
    
    if (genre.includes('rock') || genre.includes('metal') || genre.includes('punk')) {
      return 'Rock'
    }
    if (genre.includes('pop') || genre.includes('dance')) {
      return 'Pop'
    }
    if (genre.includes('hip hop') || genre.includes('rap')) {
      return 'Hip-Hop'
    }
    if (genre.includes('country')) {
      return 'Country'
    }
    if (genre.includes('electronic') || genre.includes('techno') || genre.includes('edm')) {
      return 'Electronic'
    }
    if (genre.includes('jazz') || genre.includes('blues')) {
      return 'Jazz'
    }
    if (genre.includes('classical')) {
      return 'Classical'
    }
    
    // Capitalize first letter
    return genre.charAt(0).toUpperCase() + genre.slice(1)
  }

  private removeDuplicateEvents(events: Event[]): Event[] {
    const seen = new Set<string>()
    const unique: Event[] = []
    
    for (const event of events) {
      // Create a key based on title, date, and venue
      const key = `${event.title.toLowerCase().trim()}|${event.date}|${event.venue.toLowerCase().trim()}`
      
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(event)
      }
    }
    
    return unique
  }

  private getMockBandsinTownEvents(params: EventSearchParams): Event[] {
    // Mock events to demonstrate the integration
    const baseDate = new Date()
    
    return [
      {
        id: 'bt_mock_1',
        title: 'The Weeknd Live',
        description: 'Live concert featuring The Weeknd • R&B and Pop hits from After Hours and Dawn FM • VIP packages available',
        date: new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Madison Square Garden',
        address: 'New York, NY, United States',
        category: 'Pop',
        distance: 8.5
      },
      {
        id: 'bt_mock_2',
        title: 'Arctic Monkeys Live',
        description: 'Live concert featuring Arctic Monkeys • Indie rock legends performing hits from The Car • Also featuring: The Strokes',
        date: new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'Red Rocks Amphitheatre',
        address: 'Morrison, CO, United States',
        category: 'Rock',
        distance: 12.3
      },
      {
        id: 'bt_mock_3',
        title: 'Bad Bunny Live',
        description: 'Live concert featuring Bad Bunny • Reggaeton superstar Un Verano Sin Ti World Tour • Special guest appearances',
        date: new Date(baseDate.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        venue: 'MetLife Stadium',
        address: 'East Rutherford, NJ, United States',
        category: 'Hip-Hop',
        distance: 6.7
      }
    ]
  }
}