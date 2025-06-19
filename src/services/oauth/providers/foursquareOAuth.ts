import type { OAuthProvider, OAuthConfig, OAuthToken } from '@/types/oauth'

export class FoursquareOAuthProvider implements OAuthProvider {
  readonly name = 'Foursquare'
  readonly config: OAuthConfig

  constructor() {
    this.config = {
      clientId: process.env.NEXT_PUBLIC_FOURSQUARE_CLIENT_ID || '',
      clientSecret: process.env.FOURSQUARE_CLIENT_SECRET || '',
      redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/oauth/callback/foursquare`,
      scope: ['read_public'],
      authUrl: 'https://foursquare.com/oauth2/authenticate',
      tokenUrl: 'https://foursquare.com/oauth2/access_token'
    }
  }

  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope.join(' ')
    })

    if (state) {
      params.append('state', state)
    }

    return `${this.config.authUrl}?${params.toString()}`
  }

  async exchangeCodeForToken(code: string, state?: string): Promise<OAuthToken> {
    const response = await fetch('/api/oauth/token/foursquare', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code,
        state,
        redirectUri: this.config.redirectUri
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token exchange failed: ${error}`)
    }

    const data = await response.json()
    
    return {
      accessToken: data.access_token,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope ? data.scope.split(' ') : this.config.scope,
      expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined
    }
  }

  async refreshToken(refreshToken: string): Promise<OAuthToken> {
    // Foursquare doesn't typically use refresh tokens - tokens don't expire
    // But we'll implement this for completeness
    throw new Error('Foursquare tokens do not require refresh')
  }

  async revokeToken(token: string): Promise<void> {
    try {
      await fetch('/api/oauth/revoke/foursquare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      })
    } catch (error) {
      console.warn('Failed to revoke Foursquare token:', error)
    }
  }

  validateToken(token: OAuthToken): boolean {
    if (!token.accessToken) return false
    
    // Check if token is expired
    if (token.expiresAt && Date.now() > token.expiresAt) {
      return false
    }
    
    return true
  }

  // Helper method to get authenticated headers
  getAuthHeaders(token: OAuthToken): Record<string, string> {
    return {
      'Authorization': `Bearer ${token.accessToken}`,
      'Accept': 'application/json'
    }
  }

  // Helper method to make authenticated API calls
  async makeAuthenticatedRequest(
    url: string, 
    token: OAuthToken, 
    options: RequestInit = {}
  ): Promise<Response> {
    return fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(token),
        ...options.headers
      }
    })
  }
}