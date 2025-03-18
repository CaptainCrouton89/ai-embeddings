'use client'

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
import { createClient } from '@supabase/supabase-js'
import { Eye, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

// Get Supabase URL from environment variable
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

interface PageData {
  id: string
  path: string
  type: string
  source: string
  created_at: string
  updated_at: string
  section_count: number
}

export function EmbeddingsHistory() {
  const [pages, setPages] = useState<PageData[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

  const fetchEmbeddings = async () => {
    setLoading(true)
    try {
      const { data: pagesData, error } = await supabase
        .from('nods_page')
        .select(
          `
          id, 
          path, 
          type, 
          source, 
          created_at, 
          updated_at, 
          sections:nods_page_section(count)
        `
        )
        .order('updated_at', { ascending: false })

      if (error) {
        throw error
      }

      // Transform data to include section_count
      const transformedData: PageData[] = pagesData.map((page) => ({
        id: page.id,
        path: page.path,
        type: page.type,
        source: page.source,
        created_at: page.created_at,
        updated_at: page.updated_at,
        section_count: page.sections[0]?.count || 0,
      }))

      setPages(transformedData)
    } catch (error) {
      console.error('Error fetching embeddings:', error)
      toast.error('Failed to load embeddings history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmbeddings()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Embeddings History</CardTitle>
          <CardDescription>
            Previously generated embeddings stored in your database.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEmbeddings} disabled={loading}>
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
        ) : pages.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No embeddings found. Generate some embeddings to see them here.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sections</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">{page.path}</TableCell>
                    <TableCell>{page.type}</TableCell>
                    <TableCell>{page.section_count}</TableCell>
                    <TableCell>{formatDate(page.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
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
