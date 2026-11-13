import { useInfiniteQuery, type QueryClient } from '@tanstack/react-query'
import type { Document } from 'shared'
import { api, errorCode } from '~/shared/lib/api.ts'

type Page = { items: Document[]; cursor?: string }

const documentsKey = ['documents']

export const documentKey = (id: string) => [...documentsKey, id]

// Reloads the list before the app returns to it, so a saved or deleted document shows at once.
export const refreshDocuments = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: documentsKey, exact: true, refetchType: 'all' })

// The account's documents, newest first, fetched one page at a time.
export function useDocuments() {
  const query = useInfiniteQuery({
    queryKey: documentsKey,
    queryFn: ({ pageParam }) =>
      api.get<Page>(pageParam ? `/documents?cursor=${encodeURIComponent(pageParam)}` : '/documents'),
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
