'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

const formSchema = z.object({
  content: z.string().min(1, { message: 'Content is required' }),
  path: z.string().min(1, { message: 'Path is required' }),
  parentPath: z.string().optional(),
  type: z.enum(['markdown', 'html', 'text']).default('markdown'),
  source: z.string().default('ui'),
  meta: z.record(z.string(), z.any()).optional(),
})

type FormValues = z.infer<typeof formSchema>

export function EmbeddingGenerator() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ page: any; sections: number } | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: '',
      path: '',
      parentPath: '',
      type: 'markdown',
      source: 'ui',
    },
  })

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true)
    setResult(null)

    try {
      const response = await fetch('/api/generate-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate embeddings')
      }

      setResult(data)
      toast.success(`Successfully generated embeddings for ${values.path}`)
    } catch (error) {
      console.error('Error generating embeddings:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate embeddings')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Generate Embeddings</CardTitle>
        <CardDescription>
          Create new embeddings for your content that can be used for semantic search.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="file" disabled>
              File Upload (Coming Soon)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="path"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Path</FormLabel>
                      <FormControl>
                        <Input placeholder="/docs/getting-started" {...field} />
                      </FormControl>
                      <FormDescription>
                        A unique identifier for this content (e.g., URL path)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parentPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Path (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="/docs" {...field} />
                      </FormControl>
                      <FormDescription>Parent path if this is a child document</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Type</FormLabel>
                      <div className="flex space-x-4">
                        {['markdown', 'html', 'text'].map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id={type}
                              value={type}
                              checked={field.value === type}
                              onChange={() => field.onChange(type)}
                            />
                            <label htmlFor={type} className="capitalize">
                              {type}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="# Your Content Here"
                          className="min-h-[300px] font-mono"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>The content to generate embeddings for</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Generating...' : 'Generate Embeddings'}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>

        {result && (
          <>
            <Separator className="my-6" />
            <Alert className="mt-6 bg-green-50 dark:bg-green-950">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                Generated {result.sections} sections for {result.page.path}
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  )
}
