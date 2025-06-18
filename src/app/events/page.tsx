'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import EventCard from '@/components/EventCard'
import TimeFilter from '@/components/TimeFilter'
import { mockEvents } from '@/data/mockEvents'
import type { Event } from '@/types/event'

export default function EventsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [timeframe, setTimeframe] = useState('today')
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])

  const zip = searchParams.get('zip')
  const distance = searchParams.get('distance')

  useEffect(() => {
    if (!zip || !distance) {
      router.push('/')
      return
    }

    const filtered = mockEvents.filter((event) => {
      const eventDate = new Date(event.date)
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)
      
      switch (timeframe) {
        case 'today':
          return eventDate.toDateString() === today.toDateString()
        case 'week':
          const weekFromNow = new Date(today)
          weekFromNow.setDate(today.getDate() + 7)
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

    setFilteredEvents(filtered)
  }, [timeframe, zip, distance, router])

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

        <div className="space-y-4">
          {filteredEvents.length === 0 ? (
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