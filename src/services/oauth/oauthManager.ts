import type { 
  OAuthProvider, 
  OAuthToken, 
  OAuthState, 
  StoredOAuthData, 
  ProviderStatus, 
  OAuthStatus 
} from '@/types/oauth'

export class OAuthManager {
  private providers: Map<string, OAuthProvider> = new Map()
  private storageKey = 'eventfinder_oauth_tokens'

  constructor() {
    this.loadTokensFromStorage()
  }

  registerProvider(provider: OAuthProvider) {
    this.providers.set(provider.name.toLowerCase(), provider)
  }

  getProvider(name: string): OAuthProvider | undefined {
    return this.providers.get(name.toLowerCase())
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  // Generate OAuth authorization URL
  getAuthUrl(providerName: string, redirectPath?: string): string {
    const provider = this.getProvider(providerName)
    if (!provider) {
      throw new Error(`OAuth provider '${providerName}' not registered`)
    }

    const state = this.generateState(providerName, redirectPath)
    return provider.getAuthUrl(state)
  }

  // Handle OAuth callback
  async handleCallback(
    providerName: string, 
    code: string, 
    state: string
  ): Promise<{ success: boolean; redirectPath?: string; error?: string }> {
    try {
      const provider = this.getProvider(providerName)
      if (!provider) {
        return { success: false, error: `Provider '${providerName}' not found` }
      }

      // Validate state
      const stateData = this.validateState(state)
      if (!stateData || stateData.provider !== providerName) {
        return { success: false, error: 'Invalid state parameter' }
      }

      // Exchange code for token
      const token = await provider.exchangeCodeForToken(code, state)
      
      // Store token
      this.storeToken(providerName, token)
      
      return { 
        success: true, 
        redirectPath: stateData.redirectPath || '/events' 
      }
    } catch (error) {
      console.error(`OAuth callback error for ${providerName}:`, error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  // Get stored token for provider
  getToken(providerName: string): OAuthToken | null {
    const tokens = this.getStoredTokens()
    const providerData = tokens[providerName.toLowerCase()]
    
    if (!providerData) return null

    const provider = this.getProvider(providerName)
    if (!provider || !provider.validateToken(providerData.token)) {
      this.removeToken(providerName)
      return null
    }

    return providerData.token
  }

  // Check if provider is connected and token is valid
  isConnected(providerName: string): boolean {
    const token = this.getToken(providerName)
    return !!token
  }

  // Get status for all providers
  getProviderStatuses(): ProviderStatus[] {
    return Array.from(this.providers.values()).map(provider => {
      const token = this.getToken(provider.name)
      const tokens = this.getStoredTokens()
      const providerData = tokens[provider.name.toLowerCase()]

      let status: OAuthStatus = 'disconnected'
      if (token) {
        status = 'connected'
        if (token.expiresAt && Date.now() > token.expiresAt) {
          status = 'expired'
        }
      }

      return {
        name: provider.name,
        status,
        lastConnected: providerData?.lastUpdated,
        expiresAt: token?.expiresAt,
        scopes: token?.scope
      }
    })
  }

  // Refresh token if possible
  async refreshToken(providerName: string): Promise<boolean> {
    try {
      const provider = this.getProvider(providerName)
      const currentToken = this.getToken(providerName)
      
      if (!provider || !currentToken?.refreshToken) {
        return false
      }

      const newToken = await provider.refreshToken(currentToken.refreshToken)
      this.storeToken(providerName, newToken)
      return true
    } catch (error) {
      console.error(`Token refresh failed for ${providerName}:`, error)
      return false
    }
  }

  // Disconnect provider
  async disconnect(providerName: string): Promise<void> {
    try {
      const provider = this.getProvider(providerName)
      const token = this.getToken(providerName)
      
      if (provider && token) {
        await provider.revokeToken(token.accessToken)
      }
    } catch (error) {
      console.warn(`Token revocation failed for ${providerName}:`, error)
    } finally {
      this.removeToken(providerName)
    }
  }

  // Private methods
  private generateState(providerName: string, redirectPath?: string): string {
    const stateData: OAuthState = {
      provider: providerName,
      redirectPath,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2, 15)
    }
    
    const stateString = JSON.stringify(stateData)
    return btoa(stateString)
  }

  private validateState(state: string): OAuthState | null {
    try {
      const stateString = atob(state)
      const stateData: OAuthState = JSON.parse(stateString)
      
      // Check if state is not too old (10 minutes)
      if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
        return null
      }
      
      return stateData
    } catch {
      return null
    }
  }

  private storeToken(providerName: string, token: OAuthToken): void {
    const tokens = this.getStoredTokens()
    tokens[providerName.toLowerCase()] = {
      token,
      lastUpdated: Date.now()
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(tokens))
    }
  }

  private removeToken(providerName: string): void {
    const tokens = this.getStoredTokens()
    delete tokens[providerName.toLowerCase()]
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(tokens))
    }
  }

  private getStoredTokens(): StoredOAuthData {
    if (typeof window === 'undefined') return {}
    
    try {
      const stored = localStorage.getItem(this.storageKey)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  private loadTokensFromStorage(): void {
    // Tokens are loaded lazily when needed
  }
}

// Singleton instance
export const oauthManager = new OAuthManager()