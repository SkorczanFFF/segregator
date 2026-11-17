import { useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Document, DocumentList, Draft, FileChoice, FileVersion, ReadUse, StorageUse } from 'shared'
import { api, API_BASE, errorCode } from '~/shared/lib/api.ts'

const documentsKey = ['documents']

export const documentKey = (id: string) => [...documentsKey, id]

const readsKey = ['reads']

// How often a document whose file is processed or read is asked for again.
const PENDING_REFRESH = 1000

// The model is reading the document's file.
export const isReading = (doc?: Document | Draft) => doc?.read?.status === 'reading'

// The API answers this address with a short-lived link to one version of the document's file.
export const fileUrl = (id: string, version: FileVersion) =>
  `${API_BASE}/documents/${id}/file${version === 'processed' ? '?version=processed' : ''}`

// Reloads the list before the app returns to it, so a saved or deleted document shows at once.
export const refreshDocuments = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: documentsKey, exact: true, refetchType: 'all' })

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

// The account's readings this month against its limit.
export const useReadUse = () => useQuery({ queryKey: readsKey, queryFn: () => api.get<ReadUse>('/documents/reads') })

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

// How much of the account's storage its files take.
export const useStorageUse = () =>
  useQuery({ queryKey: ['storage'], queryFn: () => api.get<StorageUse>('/documents/storage') })

// The account's documents, newest first, fetched one page at a time.
export function useDocuments() {
  const query = useInfiniteQuery({
    queryKey: documentsKey,
    queryFn: ({ pageParam }) =>
      api.get<DocumentList>(pageParam ? `/documents?cursor=${encodeURIComponent(pageParam)}` : '/documents'),
    initialPageParam: '',
    getNextPageParam: (page) => page.cursor,
  })

  return {
    items: query.data?.pages.flatMap((page) => page.items),
    error: query.error ? errorCode(query.error) : undefined,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
    loadingMore: query.isFetchingNextPage,
  }
}
