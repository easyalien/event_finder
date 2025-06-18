import type { Event } from '@/types/event'

export const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Summer Music Festival',
    description: 'Join us for an amazing day of live music featuring local and national artists across multiple genres.',
    date: new Date().toISOString(),
    venue: 'City Park Amphitheater',
    address: '123 Park Ave, City, ST 12345',
    category: 'Music',
    distance: 2.5
  },
  {
    id: '2',
    title: 'Food Truck Rally',
    description: 'Taste delicious food from over 20 local food trucks. Something for everyone!',
    date: new Date().toISOString(),
    venue: 'Downtown Square',
    address: '456 Main St, City, ST 12345',
    category: 'Food',
    distance: 1.8
  },
  {
    id: '3',
    title: 'Art Gallery Opening',
    description: 'Celebrate the opening of our new contemporary art exhibition featuring emerging local artists.',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    venue: 'Modern Art Gallery',
    address: '789 Culture Blvd, City, ST 12345',
    category: 'Arts',
    distance: 3.2
  },
  {
    id: '4',
    title: 'Farmers Market',
    description: 'Fresh produce, artisan goods, and live entertainment every Saturday morning.',
    date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    venue: 'Community Center Parking Lot',
    address: '321 Community Dr, City, ST 12345',
    category: 'Market',
    distance: 4.1
  },
  {
    id: '5',
    title: 'Tech Meetup: React & Next.js',
    description: 'Monthly meetup for developers to share knowledge and network. This month focusing on React 18 features.',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    venue: 'Tech Hub Coworking',
    address: '555 Innovation Way, City, ST 12345',
    category: 'Technology',
    distance: 2.9
  },
  {
    id: '6',
    title: 'Yoga in the Park',
    description: 'Free outdoor yoga class suitable for all levels. Bring your own mat and water.',
    date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    venue: 'Riverside Park',
    address: '777 River Rd, City, ST 12345',
    category: 'Health',
    distance: 1.5
  },
  {
    id: '7',
    title: 'Comedy Night',
    description: 'Laugh the night away with stand-up comedy from both established and up-and-coming comedians.',
    date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    venue: 'The Laugh Track',
    address: '888 Comedy Ln, City, ST 12345',
    category: 'Entertainment',
    distance: 3.7
  },
  {
    id: '8',
    title: 'Book Club Meeting',
    description: 'Monthly discussion of "The Seven Husbands of Evelyn Hugo". New members welcome!',
    date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    venue: 'Central Library',
    address: '999 Library St, City, ST 12345',
    category: 'Literature',
    distance: 2.1
  }
]