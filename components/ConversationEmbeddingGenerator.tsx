'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
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
import { Textarea } from '@/components/ui/textarea'

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, { message: 'Message content is required' }),
})

const formSchema = z.object({
  conversationId: z.string().min(1, { message: 'Conversation ID is required' }),
  userId: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  messages: z.array(messageSchema).min(1, { message: 'At least one message is required' }),
})

type FormValues = z.infer<typeof formSchema>

export function ConversationEmbeddingGenerator() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ conversationId: string; messages: number } | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      conversationId: '',
      userId: '',
      title: '',
      summary: '',
      messages: [
        { role: 'user', content: '' },
        { role: 'assistant', content: '' },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'messages',
  })

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true)
    setResult(null)

    try {
      const response = await fetch('/api/store-conversation-embedding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to store conversation embeddings')
      }

      setResult(data)
      toast.success(`Successfully stored embeddings for conversation ${values.conversationId}`)
    } catch (error) {
      console.error('Error storing conversation embeddings:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to store conversation embeddings'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Store Conversation Embeddings</CardTitle>
        <CardDescription>
          Store a conversation as embeddings that can be searched semantically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="conversationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conversation ID</FormLabel>
                    <FormControl>
                      <Input placeholder="conv_123456" {...field} />
                    </FormControl>
                    <FormDescription>A unique identifier for this conversation</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User ID (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="user_123456" {...field} />
                    </FormControl>
                    <FormDescription>The user who owns this conversation</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Example conversation" {...field} />
                    </FormControl>
                    <FormDescription>A title for this conversation</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Summary (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief summary of the conversation" {...field} />
                    </FormControl>
                    <FormDescription>A short summary of the conversation</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base">Conversation Messages</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ role: 'user', content: '' })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Message
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="space-y-2 p-4 border rounded-md relative">
                  <div className="grid grid-cols-[100px_1fr] gap-4">
                    <FormField
                      control={form.control}
                      name={`messages.${index}.role`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <FormControl>
                            <select
                              className="w-full px-3 py-2 rounded-md border border-input bg-background"
                              {...field}
                            >
                              <option value="user">User</option>
                              <option value="assistant">Assistant</option>
                              <option value="system">System</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`messages.${index}.content`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Message content"
                              className="min-h-[100px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => remove(index)}
                    >
                      <Trash className="h-4 w-4 text-red-500" />
                      <span className="sr-only">Remove message</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Storing...' : 'Store Conversation Embeddings'}
            </Button>
          </form>
        </Form>

        {result && (
          <>
            <Separator className="my-6" />
            <Alert className="mt-6 bg-green-50 dark:bg-green-950">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                Stored {result.messages} messages for conversation ID: {result.conversationId}
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  )
}
