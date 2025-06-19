import type { Event } from './event'

export interface EventSearchParams {
  postalCode?: string
  latitude?: number
  longitude?: number
  radius: number
  startDateTime?: string
  endDateTime?: string
  size?: number
  page?: number
  category?: string
}

export interface EventSearchResult {
  events: Event[]
  totalCount: number
  hasMore: boolean
  source: string
}

export interface IEventProvider {
  readonly name: string
  readonly priority: number // Higher = tried first
  readonly capabilities: {
    locationSearch: boolean
    categoryFilter: boolean
    dateRange: boolean
    pagination: boolean
  }
  
  searchEvents(params: EventSearchParams): Promise<EventSearchResult>
  isAvailable(): boolean // Check if API key/config is available
}

export interface EventAggregatorConfig {
  providers: IEventProvider[]
  maxResultsPerProvider?: number
  enableDeduplication?: boolean
  parallelRequests?: boolean
}