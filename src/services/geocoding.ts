export interface Coordinates {
  latitude: number
  longitude: number
}

export interface GeocodingResult {
  coordinates: Coordinates
  formattedAddress: string
  city?: string
  state?: string
  country?: string
}

class GeocodingService {
  // Using Nominatim (OpenStreetMap) - completely free
  private readonly baseUrl = 'https://nominatim.openstreetmap.org'

  async geocodeZipCode(zipCode: string, countryCode: string = 'US'): Promise<GeocodingResult> {
    try {
      const params = new URLSearchParams({
        q: `${zipCode}, ${countryCode}`,
        format: 'json',
        limit: '1',
        addressdetails: '1'
      })

      const response = await fetch(`${this.baseUrl}/search?${params}`, {
        headers: {
          'User-Agent': 'EventFinderApp/1.0' // Required by Nominatim
        }
      })

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data || data.length === 0) {
        throw new Error(`No results found for ZIP code: ${zipCode}`)
      }

      const result = data[0]
      
      return {
        coordinates: {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon)
        },
        formattedAddress: result.display_name,
        city: result.address?.city || result.address?.town || result.address?.village,
        state: result.address?.state,
        country: result.address?.country
      }
    } catch (error) {
      console.error('Geocoding error:', error)
      throw new Error(`Failed to geocode ZIP code ${zipCode}: ${error.message}`)
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingResult> {
    try {
      const params = new URLSearchParams({
        lat: latitude.toString(),
        lon: longitude.toString(),
        format: 'json',
        addressdetails: '1'
      })

      const response = await fetch(`${this.baseUrl}/reverse?${params}`, {
        headers: {
          'User-Agent': 'EventFinderApp/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.status}`)
      }

      const result = await response.json()
      
      return {
        coordinates: { latitude, longitude },
        formattedAddress: result.display_name,
        city: result.address?.city || result.address?.town || result.address?.village,
        state: result.address?.state,
        country: result.address?.country
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error)
      throw new Error(`Failed to reverse geocode coordinates: ${error.message}`)
    }
  }
}

export const geocodingService = new GeocodingService()