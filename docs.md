# Conversation Embeddings API Documentation

This document provides an overview of the conversation embedding functionality, including storing conversations and searching through them semantically.

## Table of Contents

- [Overview](#overview)
- [Data Models](#data-models)
- [Store Conversation Endpoint](#store-conversation-endpoint)
- [Search Conversation Endpoint](#search-conversation-endpoint)
- [Frontend Components](#frontend-components)
- [Usage Examples](#usage-examples)

## Overview

The conversation embeddings system allows storing and semantically searching through conversations. Each message in a conversation is converted into an embedding vector using OpenAI's text-embedding-ada-002 model. These vectors enable semantic similarity searches to find relevant content.

Key features:

- Store complete conversations with metadata
- Generate embeddings for each message
- Search conversations by semantic similarity
- Retrieve context around matching messages

## Data Models

### Database Schema

The system uses two primary tables:

1. **conversation_history**

   - `id`: Primary key
   - `conversation_id`: Unique identifier for the conversation
   - `title`: Optional title of the conversation
   - `summary`: Optional summary of the conversation
   - `created_at`: Timestamp when the conversation was created
   - `metadata`: JSON field for additional metadata

2. **conversation_message**
   - `id`: Primary key
   - `conversation_id`: Foreign key to conversation_history
   - `role`: Message role ('user', 'assistant', or 'system')
   - `content`: Message text content
   - `created_at`: Timestamp when the message was created
   - `token_count`: Number of tokens in the message
   - `embedding`: Vector representation (1536 dimensions)
   - `metadata`: JSON field for additional message metadata

### Request/Response Models

#### Conversation Storage

```typescript
// Request
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

// Response
interface StoreResponse {
  success: boolean
  conversationId: string
  messages: number
}
```

#### Conversation Search

```typescript
// Request
interface SearchParams {
  query: string
  conversationId?: string
  matchCount?: number
  matchThreshold?: number
  includeContext?: boolean
}

// Response
interface SearchResponse {
  success: boolean
  matches: MessageMatch[] | EnrichedMatch[]
}

interface MessageMatch {
  id: number
  conversation_id: number
  role: string
  content: string
  created_at: string
  similarity: number
}

interface EnrichedMatch extends MessageMatch {
  conversation: {
    conversation_id: string
    title: string | null
    created_at: string
  }
  context: {
    id: number
    role: string
    content: string
    created_at: string
  }[]
}
```

## Store Conversation Endpoint

`POST /api/store-conversation-embedding`

Stores a conversation with its messages and generates embeddings for each message.

### Request

```json
{
  "conversationId": "conv_123456",
  "title": "Example Conversation",
  "summary": "A conversation about AI embeddings",
  "messages": [
    {
      "role": "user",
      "content": "How do embeddings work?"
    },
    {
      "role": "assistant",
      "content": "Embeddings convert text into numerical vectors that capture semantic meaning..."
    }
  ],
  "metadata": {
    "source": "web",
    "tags": ["embeddings", "AI"]
  }
}
```

### Response

```json
{
  "success": true,
  "conversationId": "conv_123456",
  "messages": 2
}
```

### Process Flow

1. Validate the incoming request data
2. Create or update the conversation record in `conversation_history`
3. For each message in the conversation:
   - Generate an embedding using OpenAI's text-embedding-ada-002 model
   - Store the message and its embedding in `conversation_message`
4. Return success with the number of messages stored

## Search Conversation Endpoint

`POST /api/search-conversation-embeddings`

Searches for messages in conversations based on semantic similarity.

### Request

```json
{
  "query": "How do neural networks learn?",
  "conversationId": "conv_123456", // optional, to search within a specific conversation
  "matchCount": 5, // optional, defaults to 5
  "matchThreshold": 0.7, // optional, defaults to 0.7
  "includeContext": true // optional, defaults to false
}
```

### Response

```json
{
  "success": true,
  "matches": [
    {
      "id": 42,
      "conversation_id": 123,
      "role": "assistant",
      "content": "Neural networks learn through a process called backpropagation...",
      "created_at": "2024-05-23T14:30:00Z",
      "similarity": 0.92,
      "conversation": {
        "conversation_id": "conv_123456",
        "title": "AI Learning Discussion",
        "created_at": "2024-05-23T14:00:00Z"
      },
      "context": [
        {
          "id": 41,
          "role": "user",
          "content": "How do neural networks learn?",
          "created_at": "2024-05-23T14:29:00Z"
        },
        {
          "id": 42,
          "role": "assistant",
          "content": "Neural networks learn through a process called backpropagation...",
          "created_at": "2024-05-23T14:30:00Z"
        }
      ]
    }
  ]
}
```

### Process Flow

1. Validate the incoming request data
2. Convert the search query to an embedding using OpenAI's model
3. Use `match_conversation_messages` Postgres function to find similar messages
4. If a specific conversation ID is provided, filter to that conversation
5. If context is requested, fetch surrounding messages for each match
6. Return results with similarity scores

## Frontend Components

The system includes three main frontend components:

1. **ConversationEmbeddingGenerator**: Form to input and store conversations
2. **ConversationSearch**: Interface to search through conversations
3. **ConversationEmbeddingsHistory**: View and manage stored conversations

## Usage Examples

### Storing a Conversation

```javascript
const storeConversation = async () => {
  const conversation = {
    conversationId: 'unique_id_123',
    title: 'Customer Support Conversation',
    summary: 'Resolving an issue with account access',
    messages: [
      { role: 'user', content: "I can't log into my account" },
      {
        role: 'assistant',
        content: "I'm sorry to hear that. Have you tried resetting your password?",
      },
      { role: 'user', content: "Yes, but I'm not receiving the reset email" },
    ],
  }

  const response = await fetch('/api/store-conversation-embedding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(conversation),
  })

  const data = await response.json()
  console.log(`Stored ${data.messages} messages for conversation ${data.conversationId}`)
}
```

### Searching Conversations

```javascript
const searchConversations = async () => {
  const searchParams = {
    query: 'account login problems',
    matchCount: 5,
    matchThreshold: 0.7,
    includeContext: true,
  }

  const response = await fetch('/api/search-conversation-embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(searchParams),
  })

  const data = await response.json()
  console.log(`Found ${data.matches.length} relevant messages`)

  // Display results
  data.matches.forEach((match) => {
    console.log(`Match (${(match.similarity * 100).toFixed(0)}%): ${match.content}`)
    if (match.context) {
      console.log('Context:')
      match.context.forEach((msg) => console.log(`- ${msg.role}: ${msg.content}`))
    }
  })
}
```
