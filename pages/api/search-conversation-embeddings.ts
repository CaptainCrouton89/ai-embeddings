import { ApplicationError, UserError } from '@/lib/errors'
import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { Configuration, OpenAIApi } from 'openai-edge'

const openAiKey = process.env.OPENAI_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const config = new Configuration({
  apiKey: openAiKey,
})
const openai = new OpenAIApi(config)

export const runtime = 'edge'

interface SearchParams {
  query: string
  userId?: string
  conversationId?: string
  matchCount?: number
  matchThreshold?: number
  includeContext?: boolean
}

interface MessageMatch {
  id: number
  conversation_id: number
  role: string
  content: string
  created_at: string
  similarity: number
}

interface ConversationData {
  conversation_id: string
  title: string | null
  created_at: string
}

interface ContextMessage {
  id: number
  role: string
  content: string
  created_at: string
}

interface EnrichedMatch extends MessageMatch {
  conversation: ConversationData
  context: ContextMessage[]
}

export default async function handler(req: NextRequest) {
  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          error: 'Method not allowed',
        }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    if (!openAiKey) {
      throw new ApplicationError('Missing environment variable OPENAI_KEY')
    }

    if (!supabaseUrl) {
      throw new ApplicationError('Missing environment variable SUPABASE_URL')
    }

    if (!supabaseServiceKey) {
      throw new ApplicationError('Missing environment variable SUPABASE_SERVICE_ROLE_KEY')
    }

    const requestData = await req.json()

    if (!requestData) {
      throw new UserError('Missing request data')
    }

    const {
      query,
      userId,
      conversationId,
      matchCount = 5,
      matchThreshold = 0.7,
      includeContext = false,
    } = requestData as SearchParams

    if (!query) {
      throw new UserError('Missing query in request data')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Create embedding from query
    const sanitizedQuery = query.trim().replace(/\n/g, ' ')
    const embeddingResponse = await openai.createEmbedding({
      model: 'text-embedding-ada-002',
      input: sanitizedQuery,
    })

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.json()
      throw new ApplicationError('Failed to create embedding for query', error)
    }

    const embeddingData = await embeddingResponse.json()

    if (
      !embeddingData ||
      !embeddingData.data ||
      !Array.isArray(embeddingData.data) ||
      embeddingData.data.length === 0
    ) {
      throw new ApplicationError('Invalid embedding response format', embeddingData)
    }

    const { embedding } = embeddingData.data[0]

    // Find specific conversation if conversationId is provided
    let filterConversationId: number | null = null

    if (conversationId) {
      const { data: specificConversation, error: specificConversationError } = await supabaseClient
        .from('conversation_history')
        .select('id')
        .eq('conversation_id', conversationId)
        .limit(1)
        .single()

      if (specificConversationError) {
        throw specificConversationError
      }

      if (specificConversation) {
        filterConversationId = specificConversation.id
      }
    }

    // Use the match_conversation_messages function to find similar messages
    const { data: matchingMessages, error: matchError } = await supabaseClient.rpc(
      'match_conversation_messages',
      {
        query_embedding: embedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        filter_conversation_id: filterConversationId,
      }
    )

    if (matchError) {
      throw new ApplicationError('Failed to match conversation messages', matchError)
    }

    // If no userId is specified, return all matches
    let filteredMatches: MessageMatch[] | EnrichedMatch[] = matchingMessages as MessageMatch[]

    // If userId is specified, filter by user
    if (userId) {
      // Get all conversation IDs that belong to the user
      const { data: userConversations, error: userConversationsError } = await supabaseClient
        .from('conversation_history')
        .select('id')
        .eq('user_id', userId)

      if (userConversationsError) {
        throw userConversationsError
      }

      const userConversationIds = userConversations.map((c) => c.id)

      // Filter matches to only those from the user's conversations
      filteredMatches = (matchingMessages as MessageMatch[]).filter((match: MessageMatch) =>
        userConversationIds.includes(match.conversation_id)
      )
    }

    // If includeContext is true, fetch the messages before and after each match
    if (includeContext && filteredMatches.length > 0) {
      const enrichedMatches: EnrichedMatch[] = []

      for (const match of filteredMatches) {
        // Get conversation details
        const { data: conversationData, error: conversationError } = await supabaseClient
          .from('conversation_history')
          .select('conversation_id, title, created_at')
          .eq('id', match.conversation_id)
          .limit(1)
          .single()

        if (conversationError) {
          console.error('Error fetching conversation details:', conversationError)
          continue
        }

        // Get context messages (2 before and 2 after)
        const { data: contextMessages, error: contextError } = await supabaseClient
          .from('conversation_message')
          .select('id, role, content, created_at')
          .eq('conversation_id', match.conversation_id)
          .order('created_at', { ascending: true })

        if (contextError) {
          console.error('Error fetching context messages:', contextError)
          continue
        }

        // Find the index of the matched message
        const matchIndex = contextMessages.findIndex((msg: ContextMessage) => msg.id === match.id)

        if (matchIndex === -1) {
          // If we can't find the message, just add the match without context
          enrichedMatches.push({
            ...match,
            conversation: conversationData as ConversationData,
            context: [],
          })
          continue
        }

        // Get messages around the match (2 before and 2 after)
        const startIndex = Math.max(0, matchIndex - 2)
        const endIndex = Math.min(contextMessages.length - 1, matchIndex + 2)
        const context = contextMessages.slice(startIndex, endIndex + 1) as ContextMessage[]

        // Add to enriched matches
        enrichedMatches.push({
          ...match,
          conversation: conversationData as ConversationData,
          context,
        })
      }

      filteredMatches = enrichedMatches
    }

    return new Response(
      JSON.stringify({
        success: true,
        matches: filteredMatches,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (err: unknown) {
    if (err instanceof UserError) {
      return new Response(
        JSON.stringify({
          error: err.message,
          data: err.data,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } else if (err instanceof ApplicationError) {
      console.error(`${err.message}: ${JSON.stringify(err.data)}`)
    } else {
      console.error(err)
    }

    return new Response(
      JSON.stringify({
        error: 'There was an error processing your request',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
