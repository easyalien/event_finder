import { SpotifyOAuthProvider } from './oauth/providers/spotifyOAuth'

interface SpotifyArtist {
  id: string
  name: string
  genres: string[]
  popularity: number
  images: Array<{
    url: string
    height: number
    width: number
  }>
  external_urls: {
    spotify: string
  }
}

interface SpotifySearchResponse {
  artists: {
    items: SpotifyArtist[]
    total: number
    limit: number
    offset: number
  }
}

interface SpotifyTopArtistsResponse {
  items: SpotifyArtist[]
  total: number
  limit: number
  offset: number
}

export interface ArtistInfo {
  id: string
  name: string
  genres: string[]
  popularity: number
  imageUrl?: string
  spotifyUrl: string
}

export class SpotifyService {
  private spotifyProvider: SpotifyOAuthProvider
  private cachedToken: string | null = null
  private tokenExpiry: number = 0

  constructor() {
    this.spotifyProvider = new SpotifyOAuthProvider()
  }

  private async getValidToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.cachedToken && Date.now() < this.tokenExpiry) {
      return this.cachedToken
    }

    // Get new token using client credentials flow
    const tokenResponse = await this.spotifyProvider.getClientCredentialsToken()
    
    this.cachedToken = tokenResponse.access_token
    // Set expiry to 50 minutes (tokens last 1 hour, but refresh early)
    this.tokenExpiry = Date.now() + (tokenResponse.expires_in - 600) * 1000
    
    return this.cachedToken
  }

  async searchArtistsByGenre(genre: string, limit: number = 20): Promise<ArtistInfo[]> {
    if (!this.isAvailable()) {
      throw new Error('Spotify service not available. Client credentials not configured.')
    }

    const token = await this.getValidToken()
    
    // Search for artists by genre with high popularity
    const searchQuery = encodeURIComponent(`genre:"${genre}"`)
    const url = `https://api.spotify.com/v1/search?q=${searchQuery}&type=artist&limit=${limit}&market=US`
    
    const response = await this.spotifyProvider.makeAuthenticatedRequest(url, token)
    
    if (!response.ok) {
      throw new Error(`Spotify search failed: ${response.status} ${response.statusText}`)
    }
    
    const data: SpotifySearchResponse = await response.json()
    
    return data.artists.items
      .filter(artist => artist.popularity > 30) // Filter for reasonably popular artists
      .map(this.transformArtist)
      .sort((a, b) => b.popularity - a.popularity) // Sort by popularity descending
  }

  async getPopularArtists(limit: number = 50): Promise<ArtistInfo[]> {
    if (!this.isAvailable()) {
      throw new Error('Spotify service not available. Client credentials not configured.')
    }

    const token = await this.getValidToken()
    
    // Search for popular artists across multiple genres
    const genres = ['pop', 'rock', 'hip-hop', 'country', 'electronic', 'indie', 'jazz', 'classical']
    const allArtists: ArtistInfo[] = []
    
    for (const genre of genres) {
      try {
        const artists = await this.searchArtistsByGenre(genre, Math.ceil(limit / genres.length))
        allArtists.push(...artists)
      } catch (error) {
        console.warn(`Failed to get artists for genre ${genre}:`, error)
      }
    }
    
    // Remove duplicates and sort by popularity
    const uniqueArtists = this.removeDuplicateArtists(allArtists)
    return uniqueArtists
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit)
  }

  async getArtistsForLocation(location: string, limit: number = 30): Promise<ArtistInfo[]> {
    // For location-based search, we'll use a mix of popular artists
    // and try to find local/regional artists if possible
    
    // First get generally popular artists
    const popularArtists = await this.getPopularArtists(Math.floor(limit * 0.7))
    
    // Try to find location-specific artists (this is limited without user data)
    const locationArtists = await this.searchLocationArtists(location, Math.floor(limit * 0.3))
    
    const combined = [...popularArtists, ...locationArtists]
    const unique = this.removeDuplicateArtists(combined)
    
    return unique.slice(0, limit)
  }

  private async searchLocationArtists(location: string, limit: number): Promise<ArtistInfo[]> {
    try {
      const token = await this.getValidToken()
      
      // Search for artists with location in their name or description
      // This is a best-effort approach since we don't have user location data
      const searchQuery = encodeURIComponent(`"${location}"`)
      const url = `https://api.spotify.com/v1/search?q=${searchQuery}&type=artist&limit=${limit}&market=US`
      
      const response = await this.spotifyProvider.makeAuthenticatedRequest(url, token)
      
      if (!response.ok) {
        return []
      }
      
      const data: SpotifySearchResponse = await response.json()
      
      return data.artists.items
        .filter(artist => artist.popularity > 20)
        .map(this.transformArtist)
    } catch (error) {
      console.warn('Failed to search location-specific artists:', error)
      return []
    }
  }

  private transformArtist = (spotifyArtist: SpotifyArtist): ArtistInfo => {
    return {
      id: spotifyArtist.id,
      name: spotifyArtist.name,
      genres: spotifyArtist.genres,
      popularity: spotifyArtist.popularity,
      imageUrl: spotifyArtist.images?.[0]?.url,
      spotifyUrl: spotifyArtist.external_urls.spotify
    }
  }

  private removeDuplicateArtists(artists: ArtistInfo[]): ArtistInfo[] {
    const seen = new Set<string>()
    const unique: ArtistInfo[] = []
    
    for (const artist of artists) {
      if (!seen.has(artist.id)) {
        seen.add(artist.id)
        unique.push(artist)
      }
    }
    
    return unique
  }

  isAvailable(): boolean {
    return this.spotifyProvider.isAvailable()
  }
}

export const spotifyService = new SpotifyService()