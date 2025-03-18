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

        <Tabs defaultValue="search" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="mt-6">
            <SimpleSearch />
          </TabsContent>
          <TabsContent value="generate" className="mt-6">
            <EmbeddingGenerator />
          </TabsContent>
          <TabsContent value="history" className="mt-6">
            <EmbeddingsHistory />
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}
