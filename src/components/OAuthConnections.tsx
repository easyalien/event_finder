'use client'

import { useEffect, useState } from 'react'
import { oauthManager } from '@/services/oauth/oauthManager'
import { FoursquareOAuthProvider } from '@/services/oauth/providers/foursquareOAuth'
import { MeetupOAuthProvider } from '@/services/oauth/providers/meetupOAuth'
import type { ProviderStatus } from '@/types/oauth'

// Register providers
oauthManager.registerProvider(new FoursquareOAuthProvider())
oauthManager.registerProvider(new MeetupOAuthProvider())

export default function OAuthConnections() {
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [loading, setLoading] = useState<string | null>(null)

  const loadProviderStatuses = () => {
    const statuses = oauthManager.getProviderStatuses()
    setProviders(statuses)
  }

  useEffect(() => {
    loadProviderStatuses()
    
    // Refresh every 5 seconds to show real-time status
    const interval = setInterval(loadProviderStatuses, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleConnect = async (providerName: string) => {
    try {
      setLoading(providerName)
      const authUrl = oauthManager.getAuthUrl(providerName, '/events')
      window.location.href = authUrl
    } catch (error) {
      console.error(`Failed to connect to ${providerName}:`, error)
      setLoading(null)
    }
  }

  const handleDisconnect = async (providerName: string) => {
    try {
      setLoading(providerName)
      await oauthManager.disconnect(providerName)
      loadProviderStatuses()
    } catch (error) {
      console.error(`Failed to disconnect from ${providerName}:`, error)
    } finally {
      setLoading(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600 bg-green-50'
      case 'expired': return 'text-yellow-600 bg-yellow-50'
      case 'error': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected'
      case 'expired': return 'Token Expired'
      case 'error': return 'Error'
      case 'connecting': return 'Connecting...'
      default: return 'Disconnected'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Source Connections</h3>
      
      <div className="space-y-4">
        {providers.map((provider) => (
          <div key={provider.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">
                    {provider.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900">{provider.name}</h4>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(provider.status)}`}>
                    {getStatusText(provider.status)}
                  </span>
                  {provider.status === 'connected' && provider.expiresAt && (
                    <span className="text-xs text-gray-500">
                      Expires: {new Date(provider.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {provider.scopes && provider.scopes.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Scopes: {provider.scopes.join(', ')}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex-shrink-0">
              {provider.status === 'connected' ? (
                <button
                  onClick={() => handleDisconnect(provider.name)}
                  disabled={loading === provider.name}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  {loading === provider.name ? 'Disconnecting...' : 'Disconnect'}
                </button>
              ) : (
                <button
                  onClick={() => handleConnect(provider.name)}
                  disabled={loading === provider.name}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading === provider.name ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Why Connect?</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Foursquare:</strong> Find real event venues in your area</li>
          <li>• <strong>Meetup:</strong> Discover local community events and groups</li>
          <li>• Without connections, we'll show mock/sample data</li>
        </ul>
      </div>
    </div>
  )
}