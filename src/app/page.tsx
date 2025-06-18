import ZipCodeForm from '@/components/ZipCodeForm'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Event Finder</h1>
          <p className="text-gray-600">Discover events in your area</p>
        </div>
        <ZipCodeForm />
      </div>
    </main>
  )
}
