'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCompletion } from 'ai/react'
import { Frown, Loader, Wand } from 'lucide-react'
import * as React from 'react'

export function SimpleSearch() {
  const [query, setQuery] = React.useState<string>('')
  const [matchCount, setMatchCount] = React.useState<number>(10)
  const { complete, completion, isLoading, error } = useCompletion({
    api: '/api/vector-search',
  })

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    complete(query, {
      body: {
        match_count: matchCount,
      },
    })
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ask a question..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Results:</span>
            <Input
              type="number"
              min="1"
              max="50"
              value={matchCount}
              onChange={(e) => setMatchCount(parseInt(e.target.value) || 10)}
              className="w-20"
            />
          </div>
          <Button type="submit" disabled={isLoading || !query}>
            Search
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Loader className="animate-spin h-4 w-4" />
            <p>Searching...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-500">
            <Frown className="h-4 w-4" />
            <p>Search failed. Please try again.</p>
          </div>
        )}

        {completion && !error && (
          <div className="p-4 rounded-md border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Wand className="h-4 w-4 text-green-500" />
              <h3 className="font-semibold">Result:</h3>
            </div>
            <p className="text-slate-700 dark:text-slate-300">{completion}</p>
          </div>
        )}
      </form>
    </div>
  )
}
