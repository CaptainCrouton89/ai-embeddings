import { ConversationEmbeddingGenerator } from '@/components/ConversationEmbeddingGenerator'
import { ConversationEmbeddingsHistory } from '@/components/ConversationEmbeddingsHistory'
import { ConversationSearch } from '@/components/ConversationSearch'
import { EmbeddingGenerator } from '@/components/EmbeddingGenerator'
import { EmbeddingsHistory } from '@/components/EmbeddingsHistory'
import { SimpleSearch } from '@/components/SimpleSearch'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Inter } from 'next/font/google'
import Head from 'next/head'

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  return (
    <>
      <Head>
        <title>AI Embeddings</title>
        <meta name="description" content="Generate and search OpenAI embeddings with Supabase." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="container mx-auto py-10 px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight">AI Embeddings</h1>
            <p className="text-xl text-gray-500 dark:text-gray-400 max-w-[85%]">
              Generate and search through content using OpenAI embeddings stored in Supabase.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <Tabs defaultValue="document-search" className="w-full">
          <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-6">
            <TabsTrigger value="document-search" className="whitespace-nowrap">
              Document Search
            </TabsTrigger>
            <TabsTrigger value="document-generate" className="whitespace-nowrap">
              Document Generate
            </TabsTrigger>
            <TabsTrigger value="document-history" className="whitespace-nowrap">
              Document History
            </TabsTrigger>
            <TabsTrigger value="conversation-search" className="whitespace-nowrap">
              Chat Search
            </TabsTrigger>
            <TabsTrigger value="conversation-generate" className="whitespace-nowrap">
              Chat Generate
            </TabsTrigger>
            <TabsTrigger value="conversation-history" className="whitespace-nowrap">
              Chat History
            </TabsTrigger>
          </TabsList>

          {/* Document Embeddings */}
          <TabsContent value="document-search" className="mt-6">
            <SimpleSearch />
          </TabsContent>
          <TabsContent value="document-generate" className="mt-6">
            <EmbeddingGenerator />
          </TabsContent>
          <TabsContent value="document-history" className="mt-6">
            <EmbeddingsHistory />
          </TabsContent>

          {/* Conversation Embeddings */}
          <TabsContent value="conversation-search" className="mt-6">
            <ConversationSearch />
          </TabsContent>
          <TabsContent value="conversation-generate" className="mt-6">
            <ConversationEmbeddingGenerator />
          </TabsContent>
          <TabsContent value="conversation-history" className="mt-6">
            <ConversationEmbeddingsHistory />
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}
