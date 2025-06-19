import type { Event } from '@/types/event'

interface EventCardProps {
  event: Event
}

export default function EventCard({ event }: EventCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getEventSource = (eventId: string) => {
    // Extract source from event ID prefix
    const sourceMap: Record<string, string> = {
      'tm': 'Ticketmaster',
      'eb': 'Eventbrite', 
      'sg': 'SeatGeek',
      'meetup': 'Meetup',
      'bt': 'Bandsintown',
      'yelp': 'Yelp',
      'aic': 'Art Institute'
    }
    
    const prefix = eventId.split('_')[0]
    return sourceMap[prefix] || 'Unknown'
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 sm:mb-0">
          {event.title}
        </h3>
        <div className="flex items-center text-sm text-gray-500">
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
            {event.category}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600 mb-1">Date & Time</p>
          <p className="font-medium">
            {formatDate(event.date)} at {formatTime(event.date)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Location</p>
          <p className="font-medium">{event.venue}</p>
          <p className="text-sm text-gray-500">{event.address}</p>
        </div>
      </div>
      
      <p className="text-gray-700 mb-3">{event.description}</p>
      
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">Distance: {event.distance} miles</span>
        <span className="text-gray-500">Source: {getEventSource(event.id)}</span>
      </div>
    </div>
  )
}