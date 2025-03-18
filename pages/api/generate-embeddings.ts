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
interface Section {
  heading: string | null
  slug: string | null
  content: string
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

    const { content, type = 'markdown', source = 'api', path, parentPath, meta } = requestData

    if (!content) {
      throw new UserError('Missing content in request data')
    }

    if (!path) {
      throw new UserError('Missing path in request data')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // Process the content into sections
    // This is a simplified version - you might want to add more sophisticated section splitting
    const sections = processContent(content)

    // Check for existing page in DB
    const { error: fetchPageError, data: existingPage } = await supabaseClient
      .from('nods_page')
      .select('id, path, checksum, parentPage:parent_page_id(id, path)')
      .filter('path', 'eq', path)
      .limit(1)
      .maybeSingle()

    if (fetchPageError) {
      throw fetchPageError
    }

    // If the page exists, remove old sections
    if (existingPage) {
      const { error: deletePageSectionError } = await supabaseClient
        .from('nods_page_section')
        .delete()
        .filter('page_id', 'eq', existingPage.id)

      if (deletePageSectionError) {
        throw deletePageSectionError
      }
    }

    // Find parent page if parentPath is provided
    let parentPageId = null
    if (parentPath) {
      const { error: fetchParentPageError, data: parentPage } = await supabaseClient
        .from('nods_page')
        .select()
        .filter('path', 'eq', parentPath)
        .limit(1)
        .maybeSingle()

      if (fetchParentPageError) {
        throw fetchParentPageError
      }

      if (parentPage) {
        parentPageId = parentPage.id
      }
    }

    // Generate a checksum for the content
    const checksum = await generateChecksum(content)

    // Create/update page record
    const { error: upsertPageError, data: page } = await supabaseClient
      .from('nods_page')
      .upsert(
        {
          checksum: null, // Set to null initially, update after all sections are processed
          path,
          type,
          source,
          meta,
          parent_page_id: parentPageId,
        },
        { onConflict: 'path' }
      )
      .select()
      .limit(1)
      .single()

    if (upsertPageError) {
      throw upsertPageError
    }

    // Process each section and generate embeddings
    const results = []
    for (const { slug, heading, content: sectionContent } of sections) {
      // OpenAI recommends replacing newlines with spaces for best results
      const input = sectionContent.replace(/\n/g, ' ')

      try {
        const embeddingResponse = await openai.createEmbedding({
          model: 'text-embedding-ada-002',
          input,
        })

        if (!embeddingResponse.ok) {
          const error = await embeddingResponse.json()
          throw new ApplicationError('Failed to generate embedding', error)
        }

        const { data: embeddingData } = await embeddingResponse.json()
        const [responseData] = embeddingData.data

        const { error: insertPageSectionError, data: pageSection } = await supabaseClient
          .from('nods_page_section')
          .insert({
            page_id: page.id,
            slug,
            heading,
            content: sectionContent,
            token_count: embeddingData.usage.total_tokens,
            embedding: responseData.embedding,
          })
          .select()
          .limit(1)
          .single()

        if (insertPageSectionError) {
          throw insertPageSectionError
        }

        results.push(pageSection)
      } catch (err) {
        console.error(`Failed to generate embeddings for section: ${heading || 'Untitled'}`)
        throw err
      }
    }

    // Update the page with the final checksum
    const { error: updatePageError } = await supabaseClient
      .from('nods_page')
      .update({ checksum })
      .filter('id', 'eq', page.id)

    if (updatePageError) {
      throw updatePageError
    }

    return new Response(
      JSON.stringify({
        success: true,
        page,
        sections: results.length,
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

// Helper function to process content into sections
function processContent(content: string): Section[] {
  // This is a simple implementation - you may want to enhance this
  // based on your specific content structure

  // Split by headers (##, ###, etc.)
  const sections: Section[] = []
  const lines = content.split('\n')

  let currentHeading: string | null = null
  let currentSlug: string | null = null
  let currentContent = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check if line is a heading (# or ## or ### etc.)
    if (line.startsWith('#')) {
      // If we already have content, save it as a section
      if (currentContent.trim()) {
        sections.push({
          heading: currentHeading,
          slug: currentSlug,
          content: currentContent.trim(),
        })
      }

      // Extract heading without the # symbols
      currentHeading = line.replace(/^#+\s+/, '')
      currentSlug = slugify(currentHeading)
      currentContent = line + '\n' // Include the heading in the content
    } else {
      currentContent += line + '\n'
    }
  }

  // Add the last section
  if (currentContent.trim()) {
    sections.push({
      heading: currentHeading,
      slug: currentSlug,
      content: currentContent.trim(),
    })
  }

  // If no sections were created (no headings), create one with the entire content
  if (sections.length === 0) {
    sections.push({
      heading: null,
      slug: null,
      content: content.trim(),
    })
  }

  return sections
}

// Helper function to generate a checksum
async function generateChecksum(content: string) {
  // Using a crypto-based approach that works in Edge runtime
  const msgUint8 = new TextEncoder().encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

// Helper function to create a slug from a heading
function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}
