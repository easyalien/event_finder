'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const DISTANCE_OPTIONS = [
  { value: '5', label: '5 miles' },
  { value: '10', label: '10 miles' },
  { value: '25', label: '25 miles' },
  { value: '50', label: '50 miles' },
]

export default function ZipCodeForm() {
  const [zipCode, setZipCode] = useState('')
  const [distance, setDistance] = useState('')
  const [errors, setErrors] = useState<{ zipCode?: string; distance?: string }>({})
  const router = useRouter()

  const validateZipCode = (zip: string) => {
    const zipRegex = /^\d{5}$/
    return zipRegex.test(zip)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const newErrors: { zipCode?: string; distance?: string } = {}
    
    if (!validateZipCode(zipCode)) {
      newErrors.zipCode = 'Please enter a valid 5-digit ZIP code'
    }
    
    if (!distance) {
      newErrors.distance = 'Please select a distance'
    }
    
    setErrors(newErrors)
    
    if (Object.keys(newErrors).length === 0) {
      router.push(`/events?zip=${zipCode}&distance=${distance}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-2">
          ZIP Code
        </label>
        <input
          type="text"
          id="zipCode"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
          placeholder="Enter your ZIP code"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          maxLength={5}
        />
        {errors.zipCode && (
          <p className="mt-1 text-sm text-red-600">{errors.zipCode}</p>
        )}
      </div>

      <div>
        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 mb-3">
            Search Distance
          </legend>
          <div className="space-y-2">
            {DISTANCE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="radio"
                  name="distance"
                  value={option.value}
                  checked={distance === option.value}
                  onChange={(e) => setDistance(e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
          {errors.distance && (
            <p className="mt-2 text-sm text-red-600">{errors.distance}</p>
          )}
        </fieldset>
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
      >
        Find Events
      </button>
    </form>
  )
}