'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Bot, Frown, Loader, MessageSquare, Search, User } from 'lucide-react'

interface MessageMatch {
  id: number
  conversation_id: number
  role: string
  content: string
  created_at: string
  similarity: number
  conversation?: {
    conversation_id: string
    title: string | null
    created_at: string
  }
  context?: Array<{
    id: number
    role: string
    content: string
    created_at: string
  }>
}

export function ConversationSearch() {
  const [query, setQuery] = useState('')
  const [matchCount, setMatchCount] = useState(5)
  const [matchThreshold, setMatchThreshold] = useState(0.7)
  const [includeContext, setIncludeContext] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<MessageMatch[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSearchResults(null)
    setIsSearching(true)

    try {
      const response = await fetch('/api/search-conversation-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          matchCount,
          matchThreshold,
          includeContext,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search conversation embeddings')
      }

      setSearchResults(data.matches)

      if (data.matches.length === 0) {
        toast.info('No matching results found')
      } else {
        toast.success(`Found ${data.matches.length} results`)
      }
    } catch (error) {
      console.error('Error searching conversation embeddings:', error)
      setError(error instanceof Error ? error.message : 'Failed to search conversation embeddings')
      toast.error('Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const RoleIcon = ({ role }: { role: string }) => {
    switch (role) {
      case 'user':
        return <User className="h-4 w-4 text-blue-500" />
      case 'assistant':
        return <Bot className="h-4 w-4 text-green-500" />
      case 'system':
        return <MessageSquare className="h-4 w-4 text-purple-500" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Search Conversation Embeddings</CardTitle>
        <CardDescription>
          Search through your stored conversations with semantic similarity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter your search query..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={isSearching || !query}>
              {isSearching ? (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Search
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Results Count</label>
              <Input
                type="number"
                min="1"
                max="50"
                value={matchCount}
                onChange={(e) => setMatchCount(parseInt(e.target.value) || 5)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Match Threshold</label>
              <Input
                type="number"
                min="0.1"
                max="0.99"
                step="0.05"
                value={matchThreshold}
                onChange={(e) => setMatchThreshold(parseFloat(e.target.value) || 0.7)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeContext}
                  onChange={(e) => setIncludeContext(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm font-medium">Include Context</span>
              </label>
            </div>
          </div>
        </form>

        {error && (
          <div className="flex items-center gap-2 mt-4 p-4 text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
            <Frown className="h-5 w-5" />
            <p>{error}</p>
          </div>
        )}

        {isSearching && (
          <div className="text-center py-10">
            <Loader className="mx-auto h-8 w-8 animate-spin text-gray-400" />
            <p className="mt-2 text-gray-500">Searching for relevant conversations...</p>
          </div>
        )}

        {searchResults && searchResults.length === 0 && !isSearching && !error && (
          <div className="text-center py-10 text-gray-500">
            No matching conversations found. Try a different query or adjust your search parameters.
          </div>
        )}

        {searchResults && searchResults.length > 0 && (
          <div className="mt-6 space-y-6">
            <h3 className="text-lg font-semibold">Search Results</h3>

            {searchResults.map((match) => (
              <Card key={match.id} className="overflow-hidden">
                <CardHeader className="py-3 px-4 bg-slate-50 dark:bg-slate-900">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">
                        {match.conversation?.title ||
                          match.conversation?.conversation_id ||
                          'Untitled Conversation'}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {match.conversation?.created_at &&
                          formatDate(match.conversation.created_at)}
                      </CardDescription>
                    </div>
                    <div className="text-xs bg-green-100 dark:bg-green-900 px-2 py-1 rounded-full">
                      {(match.similarity * 100).toFixed(0)}% match
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {match.context ? (
                    <div className="divide-y">
                      {match.context.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-4 flex items-start gap-3 ${
                            msg.id === match.id ? 'bg-yellow-50 dark:bg-yellow-950' : ''
                          }`}
                        >
                          <div className="mt-1">
                            <RoleIcon role={msg.role} />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <span className="text-xs font-medium capitalize mb-1">
                                {msg.role}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDate(msg.created_at)}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 flex items-start gap-3">
                      <div className="mt-1">
                        <RoleIcon role={match.role} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="text-xs font-medium capitalize mb-1">{match.role}</span>
                          <span className="text-xs text-gray-500">
                            {formatDate(match.created_at)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{match.content}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
