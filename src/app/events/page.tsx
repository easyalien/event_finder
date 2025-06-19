'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import EventCard from '@/components/EventCard'
import TimeFilter from '@/components/TimeFilter'
import OAuthConnections from '@/components/OAuthConnections'
import type { Event } from '@/types/event'

export default function EventsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [timeframe, setTimeframe] = useState('today')
  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataSources, setDataSources] = useState<string[]>([])

  const zip = searchParams.get('zip')
  const distance = searchParams.get('distance')

  useEffect(() => {
    if (!zip || !distance) {
      router.push('/')
      return
    }

    const fetchEvents = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const searchParams = {
          postalCode: zip,
          radius: parseInt(distance)
        }
        
        // Set date range to get events for next 3 months
        const startDate = new Date().toISOString()
        const endDate = new Date()
        endDate.setMonth(endDate.getMonth() + 3)
        const endDateString = endDate.toISOString()
        
        // Call the API route instead of eventService directly
        const response = await fetch(
          `/api/events?postalCode=${zip}&radius=${distance}&startDateTime=${startDate}&endDateTime=${endDateString}`
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch events')
        }
        
        const result = await response.json()
        setEvents(result.events)
        setDataSources(result.sources || [])
      } catch (err) {
        console.error('Error fetching events:', err)
        setError('Failed to load events. Please try again.')
        setEvents([])
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [zip, distance, router])

  useEffect(() => {
    if (events.length > 0) {
      const filtered = getEventsByTimeframe(events, timeframe)
      setFilteredEvents(filtered)
    } else {
      setFilteredEvents([])
    }
  }, [events, timeframe])

  const getEventsByTimeframe = (events: Event[], timeframe: string): Event[] => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    return events.filter(event => {
      const eventDate = new Date(event.date)
      
      switch (timeframe) {
        case 'today':
          return eventDate >= today && eventDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)
        
        case 'week':
          const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
          return eventDate >= today && eventDate <= weekFromNow
        
        case 'month':
          const monthFromNow = new Date(today)
          monthFromNow.setMonth(today.getMonth() + 1)
          return eventDate >= today && eventDate <= monthFromNow
        
        case '3months':
          const threeMonthsFromNow = new Date(today)
          threeMonthsFromNow.setMonth(today.getMonth() + 3)
          return eventDate >= today && eventDate <= threeMonthsFromNow
        
        default:
          return true
      }
    })
  }

  if (!zip || !distance) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Events Near {zip}
              </h1>
              <p className="text-gray-600">
                Within {distance} miles
              </p>
              {dataSources.length > 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Sources: {dataSources.join(', ')}
                </p>
              )}
            </div>
            <button
              onClick={() => router.push('/')}
              className="mt-4 sm:mt-0 px-4 py-2 text-blue-600 hover:text-blue-800 font-medium"
            >
              ← New Search
            </button>
          </div>
          
          <TimeFilter currentTimeframe={timeframe} onTimeframeChange={setTimeframe} />
        </div>

        <OAuthConnections />

        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <div className="flex justify-center items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <p className="text-gray-600">Loading events...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-500">No events found for the selected timeframe.</p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}