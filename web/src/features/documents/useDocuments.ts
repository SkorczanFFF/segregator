import { keepPreviousData, useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Document, DocumentList, Draft, FileChoice, FileVersion } from 'shared'
import { readsKey } from '~/shared/hooks/useUsage.ts'
import { api, API_BASE, errorCode } from '~/shared/lib/api.ts'

const documentsKey = ['documents']

export const documentKey = (id: string) => [...documentsKey, id]

// Every filtered list sits under this key, beside the documents' ids.
const listsKey = [...documentsKey, 'list']

// A page of the list a filter in the API's terms lets through, after the cursor when there is one.
function listPath(query: string, cursor?: string) {
  const params = new URLSearchParams(query)
  if (cursor) params.set('cursor', cursor)
  const search = params.toString()
  return search ? `/documents?${search}` : '/documents'
}

// How often a document whose file is processed or read is asked for again.
const PENDING_REFRESH = 1000

// The model is reading the document's file.
export const isReading = (doc?: Document | Draft) => doc?.read?.status === 'reading'

// The API answers this address with a short-lived link to one version of the document's file.
export const fileUrl = (id: string, version: FileVersion) =>
  `${API_BASE}/documents/${id}/file${version === 'processed' ? '?version=processed' : ''}`

// Reloads the lists before the app returns to them, so a saved or deleted document shows at once.
export const refreshDocuments = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: listsKey, refetchType: 'all' })

// Keeps one version of a photo preprocessing changed, and the document as the API returns it.
export async function chooseVersion(queryClient: QueryClient, id: string, use: FileVersion) {
  const doc = await api.put<Document | Draft>(`/documents/${id}/file`, { use } satisfies FileChoice)
  queryClient.setQueryData(documentKey(id), doc)
}

// Starts a reading of the document's file by the model, and keeps the document as it shows the reading.
export async function readDocument(queryClient: QueryClient, id: string) {
  queryClient.setQueryData(documentKey(id), await api.post<Document | Draft>(`/documents/${id}/read`))
  await queryClient.invalidateQueries({ queryKey: readsKey })
}

// One document or draft. While its file is processed or read, it is asked for again until that ends.
export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: documentKey(id ?? ''),
    queryFn: () => api.get<Document | Draft>(`/documents/${id}`),
    enabled: id !== undefined,
    refetchInterval: ({ state: { data } }) =>
      data?.status === 'processing' || isReading(data) ? PENDING_REFRESH : false,
  })
}

// How a reading watched from this page ended: one started here, or under way when the page opened. A reading
// that ended before is left alone, so its result never overwrites fields saved since.
export function useReadOutcome(doc?: Document | Draft) {
  const read = doc?.read
  const [watched, setWatched] = useState<string>()
  if (read && isReading(doc) && read.id !== watched) setWatched(read.id)
  if (!read || read.id !== watched || read.status === 'reading') return {}
  return {
    outcome: read.status,
    suggestion: read.status === 'done' && read.result ? { id: read.id, result: read.result } : undefined,
  }
}

// The documents a filter in the API's terms lets through, newest first, fetched one page at a time, with the
// whole list summed up. Under a new filter the previous list stays on screen until the new one comes.
export function useDocuments(filter: string) {
  const query = useInfiniteQuery({
    queryKey: [...listsKey, filter],
    queryFn: ({ pageParam }) => api.get<DocumentList>(listPath(filter, pageParam)),
    initialPageParam: '',
    getNextPageParam: (page) => page.cursor,
    placeholderData: keepPreviousData,
  })

  return {
    items: query.data?.pages.flatMap((page) => page.items),
    summary: query.data?.pages[0]?.summary,
    error: query.error ? errorCode(query.error) : undefined,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
    loadingMore: query.isFetchingNextPage,
    updating: query.isPlaceholderData,
  }
}

// Every document a filter in the API's terms lets through, page after page.
export async function fetchAllDocuments(filter: string) {
  const items: Document[] = []
  let cursor: string | undefined
  do {
    const page = await api.get<DocumentList>(listPath(filter, cursor))
    items.push(...page.items)
    cursor = page.cursor
  } while (cursor)
  return items
}
