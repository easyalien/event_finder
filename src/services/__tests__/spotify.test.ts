import { SpotifyService } from '../spotify'

// Mock the SpotifyOAuthProvider
jest.mock('../oauth/providers/spotifyOAuth', () => ({
  SpotifyOAuthProvider: jest.fn().mockImplementation(() => ({
    isAvailable: jest.fn().mockReturnValue(true),
    getClientCredentialsToken: jest.fn(),
    makeAuthenticatedRequest: jest.fn()
  }))
}))

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('SpotifyService', () => {
  let spotifyService: SpotifyService
  let mockSpotifyProvider: any

  beforeEach(() => {
    spotifyService = new SpotifyService()
    mockSpotifyProvider = (spotifyService as any).spotifyProvider
    mockFetch.mockClear()
  })

  describe('Service Configuration', () => {
    it('should initialize with SpotifyOAuthProvider', () => {
      expect(spotifyService).toBeDefined()
      expect(mockSpotifyProvider).toBeDefined()
    })

    it('should be available when provider is available', () => {
      mockSpotifyProvider.isAvailable.mockReturnValue(true)
      expect(spotifyService.isAvailable()).toBe(true)
    })

    it('should not be available when provider is not available', () => {
      mockSpotifyProvider.isAvailable.mockReturnValue(false)
      expect(spotifyService.isAvailable()).toBe(false)
    })
  })

  describe('Token Management', () => {
    it('should cache tokens until expiry', async () => {
      const mockToken = {
        access_token: 'test_access_token',
        token_type: 'Bearer',
        expires_in: 3600
      }

      mockSpotifyProvider.getClientCredentialsToken.mockResolvedValue(mockToken)
      mockSpotifyProvider.makeAuthenticatedRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ artists: { items: [] } })
      })

      // First call should get new token
      await spotifyService.searchArtistsByGenre('rock')
      expect(mockSpotifyProvider.getClientCredentialsToken).toHaveBeenCalledTimes(1)

      // Second call should use cached token
      await spotifyService.searchArtistsByGenre('pop')
      expect(mockSpotifyProvider.getClientCredentialsToken).toHaveBeenCalledTimes(1)
    })

    it('should refresh token when expired', async () => {
      const mockToken = {
        access_token: 'test_access_token',
        token_type: 'Bearer',
        expires_in: 3600
      }

      mockSpotifyProvider.getClientCredentialsToken.mockResolvedValue(mockToken)
      mockSpotifyProvider.makeAuthenticatedRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ artists: { items: [] } })
      })

      // Manually set token as expired
      ;(spotifyService as any).tokenExpiry = Date.now() - 1000

      await spotifyService.searchArtistsByGenre('rock')
      expect(mockSpotifyProvider.getClientCredentialsToken).toHaveBeenCalledTimes(1)
    })
  })

  describe('Artist Search by Genre', () => {
    beforeEach(() => {
      mockSpotifyProvider.getClientCredentialsToken.mockResolvedValue({
        access_token: 'test_token',
        expires_in: 3600
      })
    })

    it('should search for artists by genre correctly', async () => {
      const mockArtists = [
        {
          id: 'artist-1',
          name: 'Rock Band 1',
          genres: ['rock', 'alternative'],
          popularity: 85,
          images: [{ url: 'https://example.com/image1.jpg', height: 640, width: 640 }],
          external_urls: { spotify: 'https://open.spotify.com/artist/1' }
        },
        {
          id: 'artist-2',
          name: 'Rock Band 2',
          genres: ['rock', 'indie'],
          popularity: 75,
          images: [{ url: 'https://example.com/image2.jpg', height: 640, width: 640 }],
          external_urls: { spotify: 'https://open.spotify.com/artist/2' }
        }
      ]

      mockSpotifyProvider.makeAuthenticatedRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          artists: { items: mockArtists }
        })
      })

      const result = await spotifyService.searchArtistsByGenre('rock', 20)

      expect(mockSpotifyProvider.makeAuthenticatedRequest).toHaveBeenCalledWith(
        expect.stringContaining('https://api.spotify.com/v1/search'),
        'test_token'
      )

      const callUrl = mockSpotifyProvider.makeAuthenticatedRequest.mock.calls[0][0]
      expect(callUrl).toContain('q=genre%3A%22rock%22')
      expect(callUrl).toContain('type=artist')
      expect(callUrl).toContain('limit=20')

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Rock Band 1')
      expect(result[0].popularity).toBe(85)
      expect(result[1].name).toBe('Rock Band 2')
    })

    it('should filter artists by popularity threshold', async () => {
      const mockArtists = [
        {
          id: 'popular-artist',
          name: 'Popular Artist',
          genres: ['pop'],
          popularity: 90,
          images: [],
          external_urls: { spotify: 'https://open.spotify.com/artist/popular' }
        },
        {
          id: 'unpopular-artist',
          name: 'Unpopular Artist',
          genres: ['pop'],
          popularity: 20, // Below threshold of 30
          images: [],
          external_urls: { spotify: 'https://open.spotify.com/artist/unpopular' }
        }
      ]

      mockSpotifyProvider.makeAuthenticatedRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          artists: { items: mockArtists }
        })
      })

      const result = await spotifyService.searchArtistsByGenre('pop')

      // Should only return the popular artist (popularity > 30)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Popular Artist')
    })

    it('should sort artists by popularity descending', async () => {
      const mockArtists = [
        {
          id: 'artist-1',
          name: 'Less Popular',
          genres: ['jazz'],
          popularity: 60,
          images: [],
          external_urls: { spotify: 'https://open.spotify.com/artist/1' }
        },
        {
          id: 'artist-2',
          name: 'More Popular',
          genres: ['jazz'],
          popularity: 80,
          images: [],
          external_urls: { spotify: 'https://open.spotify.com/artist/2' }
        }
      ]

      mockSpotifyProvider.makeAuthenticatedRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          artists: { items: mockArtists }
        })
      })

      const result = await spotifyService.searchArtistsByGenre('jazz')

      expect(result[0].name).toBe('More Popular')
      expect(result[1].name).toBe('Less Popular')
    })
  })

  describe('Popular Artists Discovery', () => {
    beforeEach(() => {
      mockSpotifyProvider.getClientCredentialsToken.mockResolvedValue({
        access_token: 'test_token',
        expires_in: 3600
      })
    })

    it('should get popular artists across multiple genres', async () => {
      const mockArtistsResponse = {
        artists: {
          items: [
            {
              id: 'pop-artist',
              name: 'Pop Star',
              genres: ['pop'],
              popularity: 95,
              images: [],
              external_urls: { spotify: 'https://open.spotify.com/artist/pop' }
            }
          ]
        }
      }

      // Mock multiple genre searches
      mockSpotifyProvider.makeAuthenticatedRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockArtistsResponse)
      })

      const result = await spotifyService.getPopularArtists(50)

      // Should make multiple calls for different genres
      expect(mockSpotifyProvider.makeAuthenticatedRequest).toHaveBeenCalledTimes(8) // 8 genres
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle API errors gracefully', async () => {
      mockSpotifyProvider.makeAuthenticatedRequest
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ artists: { items: [] } })
        })

      const result = await spotifyService.getPopularArtists(50)

      // Should continue despite one genre failing
      expect(result).toEqual([])
    })
  })

  describe('Location-based Artist Discovery', () => {
    beforeEach(() => {
      mockSpotifyProvider.getClientCredentialsToken.mockResolvedValue({
        access_token: 'test_token',
        expires_in: 3600
      })

      // Mock getPopularArtists method
      jest.spyOn(spotifyService, 'getPopularArtists').mockResolvedValue([
        {
          id: 'artist-1',
          name: 'Popular Artist',
          genres: ['pop'],
          popularity: 80,
          spotifyUrl: 'https://open.spotify.com/artist/1'
        }
      ])
    })

    it('should get artists for a specific location', async () => {
      const mockLocationResponse = {
        artists: { items: [] }
      }

      mockSpotifyProvider.makeAuthenticatedRequest.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLocationResponse)
      })

      const result = await spotifyService.getArtistsForLocation('Chicago', 30)

      expect(result.length).toBeGreaterThan(0)
      expect(spotifyService.getPopularArtists).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should throw error when service is not available', async () => {
      mockSpotifyProvider.isAvailable.mockReturnValue(false)

      await expect(spotifyService.searchArtistsByGenre('rock'))
        .rejects.toThrow('Spotify service not available')
    })

    it('should handle authentication failures', async () => {
      mockSpotifyProvider.getClientCredentialsToken.mockRejectedValue(
        new Error('Authentication failed')
      )

      await expect(spotifyService.searchArtistsByGenre('rock'))
        .rejects.toThrow('Authentication failed')
    })

    it('should handle API request failures', async () => {
      mockSpotifyProvider.getClientCredentialsToken.mockResolvedValue({
        access_token: 'test_token',
        expires_in: 3600
      })

      mockSpotifyProvider.makeAuthenticatedRequest.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      })

      await expect(spotifyService.searchArtistsByGenre('rock'))
        .rejects.toThrow('Spotify search failed: 400 Bad Request')
    })
  })
})