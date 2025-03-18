-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Create conversation_history table
CREATE TABLE "public"."conversation_history" (
  id bigserial PRIMARY KEY,
  user_id text,
  conversation_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  summary text,
  metadata jsonb
);
ALTER TABLE "public"."conversation_history" ENABLE ROW LEVEL SECURITY;

-- Create conversation_message table for individual messages
CREATE TABLE "public"."conversation_message" (
  id bigserial PRIMARY KEY,
  conversation_id bigint NOT NULL REFERENCES public.conversation_history ON DELETE CASCADE,
  role text NOT NULL,  -- 'user', 'assistant', 'system'
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  token_count integer,
  embedding vector(1536),
  metadata jsonb
);
ALTER TABLE "public"."conversation_message" ENABLE ROW LEVEL SECURITY;

-- Create function for conversation similarity search
CREATE OR REPLACE FUNCTION match_conversation_messages(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_conversation_id bigint DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  conversation_id bigint,
  role text,
  content text,
  created_at timestamp with time zone,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    conversation_message.id,
    conversation_message.conversation_id,
    conversation_message.role,
    conversation_message.content,
    conversation_message.created_at,
    1 - (conversation_message.embedding <=> query_embedding) AS similarity
  FROM conversation_message
  WHERE 
    conversation_message.embedding IS NOT NULL
    AND 1 - (conversation_message.embedding <=> query_embedding) > match_threshold
    AND (filter_conversation_id IS NULL OR conversation_message.conversation_id = filter_conversation_id)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Create indexes for better performance
CREATE INDEX idx_conversation_history_user_id ON conversation_history(user_id);
CREATE INDEX idx_conversation_history_conversation_id ON conversation_history(conversation_id);
CREATE INDEX idx_conversation_message_conversation_id ON conversation_message(conversation_id);

-- Add basic RLS policies
CREATE POLICY "Allow users to view their own conversations"
  ON conversation_history
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Allow users to view their own conversation messages"
  ON conversation_message
  FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM conversation_history WHERE user_id = auth.uid()
  )); 