import type { IOAuthProvider, OAuthTokenResponse } from '../types'

export class SpotifyOAuthProvider implements IOAuthProvider {
  readonly name = 'spotify'
  readonly displayName = 'Spotify'
  
  private readonly clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!
  private readonly clientSecret = process.env.SPOTIFY_CLIENT_SECRET!
  private readonly tokenUrl = 'https://accounts.spotify.com/api/token'

  getAuthUrl(redirectUri: string, state?: string): string {
    // For client credentials flow, we don't need user authorization
    // This is just a placeholder for consistency with the OAuth interface
    return '#'
  }

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    // Not used in client credentials flow
    throw new Error('Authorization code flow not implemented for Spotify')
  }

  async getClientCredentialsToken(): Promise<OAuthTokenResponse> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Spotify client credentials not configured')
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
    
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Spotify token request failed: ${response.status} ${error}`)
    }

    const data = await response.json()
    
    return {
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
      scope: data.scope,
      refresh_token: undefined // Not provided in client credentials flow
    }
  }

  async makeAuthenticatedRequest(url: string, token: string): Promise<Response> {
    return fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
    // Client credentials tokens can't be refreshed, must request new one
    return this.getClientCredentialsToken()
  }

  isAvailable(): boolean {
    return !!(this.clientId && this.clientSecret)
  }
}