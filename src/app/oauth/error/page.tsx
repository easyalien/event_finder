'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function OAuthErrorPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [errorDetails, setErrorDetails] = useState<{
    provider?: string
    error?: string
  }>({})

  useEffect(() => {
    setErrorDetails({
      provider: searchParams.get('provider') || undefined,
      error: searchParams.get('error') || undefined
    })
  }, [searchParams])

  const getErrorMessage = (error?: string) => {
    switch (error) {
      case 'access_denied':
        return 'You denied access to the application.'
      case 'missing_parameters':
        return 'Missing required authentication parameters.'
      case 'callback_failed':
        return 'Authentication callback failed.'
      case 'invalid_state':
        return 'Invalid authentication state.'
      default:
        return 'An unknown error occurred during authentication.'
    }
  }

  const getProviderName = (provider?: string) => {
    switch (provider?.toLowerCase()) {
      case 'foursquare':
        return 'Foursquare'
      case 'meetup':
        return 'Meetup'
      default:
        return 'the service'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg 
              className="w-8 h-8 text-red-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.232 15.5c-.77.833.192 2.5 1.732 2.5z" 
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Authentication Failed
          </h1>
          <p className="text-gray-600">
            Unable to connect to {getProviderName(errorDetails.provider)}
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-sm text-red-800">
            {getErrorMessage(errorDetails.error)}
          </p>
          {errorDetails.error && (
            <p className="text-xs text-red-600 mt-2">
              Error code: {errorDetails.error}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/events')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Continue to Events
          </button>
          <button
            onClick={() => router.back()}
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors font-medium"
          >
            Go Back
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Having trouble? You can still use the event finder without connecting to external services.
          </p>
        </div>
      </div>
    </div>
  )
}