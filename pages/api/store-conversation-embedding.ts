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

// Define interfaces for our data structures
interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: Record<string, any>
}

interface ConversationData {
  conversationId: string
  title?: string
  summary?: string
  messages: ConversationMessage[]
  metadata?: Record<string, any>
}

export const runtime = 'edge'

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

    const { conversationId, title, summary, messages, metadata } = requestData as ConversationData

    if (!conversationId) {
      throw new UserError('Missing conversationId in request data')
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new UserError('Missing or invalid messages in request data')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // Create or update conversation record
    const { error: upsertConversationError, data: conversation } = await supabaseClient
      .from('conversation_history')
      .upsert(
        {
          conversation_id: conversationId,
          title,
          summary,
          metadata,
        },
        { onConflict: 'conversation_id' }
      )
      .select()
      .limit(1)
      .single()

    if (upsertConversationError) {
      throw upsertConversationError
    }

    // Process each message and generate embeddings
    const results = []
    for (const message of messages) {
      // Skip if message has no content
      if (!message.content || !message.role) {
        continue
      }

      // OpenAI recommends replacing newlines with spaces for best results
      const input = message.content.replace(/\n/g, ' ')

      try {
        const embeddingResponse = await openai.createEmbedding({
          model: 'text-embedding-ada-002',
          input,
        })

        if (!embeddingResponse.ok) {
          const error = await embeddingResponse.json()
          throw new ApplicationError('Failed to generate embedding', error)
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
        const tokenCount = embeddingData.usage.total_tokens

        if (!embedding) {
          throw new ApplicationError('Missing embedding in response data', embeddingData.data[0])
        }

        const { error: insertMessageError, data: messageData } = await supabaseClient
          .from('conversation_message')
          .insert({
            conversation_id: conversation.id,
            role: message.role,
            content: message.content,
            token_count: tokenCount,
            embedding,
            metadata: message.metadata || null,
          })
          .select()
          .limit(1)
          .single()

        if (insertMessageError) {
          throw insertMessageError
        }

        results.push(messageData)
      } catch (err) {
        console.error(
          `Failed to generate embeddings for message: ${message.content.substring(0, 50)}...`
        )
        throw err
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversationId: conversation.conversation_id,
        messages: results.length,
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
