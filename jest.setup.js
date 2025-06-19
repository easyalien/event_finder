// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Mock fetch globally for all tests
global.fetch = jest.fn()

// Mock environment variables for testing
process.env.NEXT_PUBLIC_TICKETMASTER_API_KEY = 'test_ticketmaster_key'
process.env.NEXT_PUBLIC_EVENTBRITE_API_TOKEN = 'test_eventbrite_token'
process.env.NEXT_PUBLIC_SEATGEEK_CLIENT_ID = 'test_seatgeek_client_id'
process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID = 'test_spotify_client_id'
process.env.SPOTIFY_CLIENT_SECRET = 'test_spotify_secret'
process.env.NEXT_PUBLIC_BANDSINTOWN_APP_ID = 'test_bandsintown_app_id'
process.env.YELP_FUSION_API_KEY = 'test_yelp_api_key'