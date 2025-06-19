export interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scope: string[]
  authUrl: string
  tokenUrl: string
}

export interface OAuthToken {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType: string
  scope?: string[]
}

export interface OAuthProvider {
  readonly name: string
  readonly config: OAuthConfig
  
  getAuthUrl(state?: string): string
  exchangeCodeForToken(code: string, state?: string): Promise<OAuthToken>
  refreshToken(refreshToken: string): Promise<OAuthToken>
  revokeToken(token: string): Promise<void>
  validateToken(token: OAuthToken): boolean
}

export interface OAuthState {
  provider: string
  redirectPath?: string
  timestamp: number
  nonce: string
}

export interface StoredOAuthData {
  [providerName: string]: {
    token: OAuthToken
    lastUpdated: number
  }
}

export type OAuthStatus = 'disconnected' | 'connecting' | 'connected' | 'expired' | 'error'

export interface ProviderStatus {
  name: string
  status: OAuthStatus
  lastConnected?: number
  expiresAt?: number
  scopes?: string[]
}