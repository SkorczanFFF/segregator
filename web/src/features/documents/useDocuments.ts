import { useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query'
import type { Document, DocumentList, Draft, FileChoice, FileVersion } from 'shared'
import { api, API_BASE, errorCode } from '~/shared/lib/api.ts'

const documentsKey = ['documents']

export const documentKey = (id: string) => [...documentsKey, id]

// How often a draft whose file is in processing is asked for again.
const PROCESSING_REFRESH = 1000

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

// One document or draft. While its file is in processing, it is asked for again until the processing ends.
export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: documentKey(id ?? ''),
    queryFn: () => api.get<Document | Draft>(`/documents/${id}`),
    enabled: id !== undefined,
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? PROCESSING_REFRESH : false),
  })
}

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
