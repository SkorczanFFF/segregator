import { useInfiniteQuery, type QueryClient } from '@tanstack/react-query'
import type { Document, DocumentList, Draft, FileVersion } from 'shared'
import { api, errorCode } from '~/shared/lib/api.ts'

const documentsKey = ['documents']

export const documentKey = (id: string) => [...documentsKey, id]

// The file is on its way or in processing, so a screen showing it asks again every second.
export const isPending = (doc: Document | Draft) => doc.status === 'uploading' || doc.status === 'processing'

export const PENDING_REFRESH = 1000

// The API answers this address with a short-lived link to one version of the document's file.
export const fileUrl = (id: string, version: FileVersion) =>
  `/api/documents/${id}/file${version === 'processed' ? '?version=processed' : ''}`

// Reloads the list before the app returns to it, so a saved or deleted document shows at once.
export const refreshDocuments = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: documentsKey, exact: true, refetchType: 'all' })

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
