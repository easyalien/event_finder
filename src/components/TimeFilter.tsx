interface TimeFilterProps {
  currentTimeframe: string
  onTimeframeChange: (timeframe: string) => void
}

const TIME_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'Next Month' },
  { value: '3months', label: 'Next 3 Months' },
]

export default function TimeFilter({ currentTimeframe, onTimeframeChange }: TimeFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TIME_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onTimeframeChange(option.value)}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            currentTimeframe === option.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}