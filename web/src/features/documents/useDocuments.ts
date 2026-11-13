import { useInfiniteQuery } from '@tanstack/react-query'
import type { Document } from 'shared'
import { api, errorCode } from '~/shared/lib/api.ts'

type Page = { items: Document[]; cursor?: string }

export const documentsKey = ['documents']

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
