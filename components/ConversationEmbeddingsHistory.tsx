'use client'

import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MessageSquare, RefreshCw, Search, Trash2 } from 'lucide-react'

// Get Supabase URL from environment variable
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

interface ConversationData {
  id: string
  conversation_id: string
  title: string | null
  summary: string | null
  created_at: string
  message_count: number
}

export function ConversationEmbeddingsHistory() {
  const [conversations, setConversations] = useState<ConversationData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create Supabase client with improved error handling
  const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

  const fetchConversations = async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('Fetching conversations with Supabase URL:', supabaseUrl)

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase credentials not found')
      }

      const { data: conversationsData, error } = await supabase
        .from('conversation_history')
        .select(
          `
          id, 
          conversation_id,
          title,
          summary,
          created_at,
          messages:conversation_message(count)
        `
        )
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase query error:', error)
        throw error
      }

      if (!conversationsData) {
        throw new Error('No data returned from Supabase')
      }

      console.log('Conversations data:', conversationsData)

      // Transform data to include message_count
      const transformedData: ConversationData[] = conversationsData.map((conversation) => ({
        id: conversation.id,
        conversation_id: conversation.conversation_id,
        title: conversation.title,
        summary: conversation.summary,
        created_at: conversation.created_at,
        message_count: conversation.messages[0]?.count || 0,
      }))

      setConversations(transformedData)
    } catch (error) {
      console.error('Error fetching conversation embeddings:', error)
      setError(error instanceof Error ? error.message : 'Failed to load conversation embeddings')
      toast.error('Failed to load conversation embeddings history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConversations()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return
    }

    try {
      const { error } = await supabase.from('conversation_history').delete().match({ id })

      if (error) {
        throw error
      }

      toast.success('Conversation deleted successfully')
      fetchConversations()
    } catch (error) {
      console.error('Error deleting conversation:', error)
      toast.error('Failed to delete conversation')
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Conversation Embeddings</CardTitle>
          <CardDescription>
            Previously stored conversation embeddings in your database.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchConversations} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">
            <p>Error: {error}</p>
            <p className="text-sm text-gray-500 mt-2">
              Check your Supabase configuration and network connection.
            </p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No conversation embeddings found. Store some conversations to see them here.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conversation ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((conversation) => (
                  <TableRow key={conversation.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {conversation.conversation_id}
                    </TableCell>
                    <TableCell>
                      {conversation.title || 'Untitled'}
                      {conversation.summary && (
                        <span className="block text-xs text-gray-500 truncate max-w-[200px]">
                          {conversation.summary}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        {conversation.message_count}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(conversation.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="icon" title="Search this conversation">
                          <Search className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete conversation"
                          onClick={() => handleDelete(conversation.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
