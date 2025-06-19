import type { OAuthProvider, OAuthConfig, OAuthToken } from '@/types/oauth'

export class MeetupOAuthProvider implements OAuthProvider {
  readonly name = 'Meetup'
  readonly config: OAuthConfig

  constructor() {
    this.config = {
      clientId: process.env.NEXT_PUBLIC_MEETUP_CLIENT_ID || '',
      clientSecret: process.env.MEETUP_CLIENT_SECRET || '',
      redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/oauth/callback/meetup`,
      scope: ['basic'],
      authUrl: 'https://secure.meetup.com/oauth2/authorize',
      tokenUrl: 'https://secure.meetup.com/oauth2/access'
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
    const response = await fetch('/api/oauth/token/meetup', {
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
      refreshToken: data.refresh_token,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope ? data.scope.split(' ') : this.config.scope,
      expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined
    }
  }

  async refreshToken(refreshToken: string): Promise<OAuthToken> {
    const response = await fetch('/api/oauth/refresh/meetup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refreshToken,
        clientId: this.config.clientId
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token refresh failed: ${error}`)
    }

    const data = await response.json()
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope ? data.scope.split(' ') : this.config.scope,
      expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      await fetch('/api/oauth/revoke/meetup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      })
    } catch (error) {
      console.warn('Failed to revoke Meetup token:', error)
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