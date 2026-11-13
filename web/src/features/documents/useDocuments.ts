import { useEffect, useState } from 'react'
import type { Document } from 'shared'
import { api, errorCode, type ApiErrorCode } from '~/shared/lib/api.ts'

type Page = { items: Document[]; cursor?: string }

const fetchPage = (after?: string) =>
  api.get<Page>(after ? `/documents?cursor=${encodeURIComponent(after)}` : '/documents')

// The account's documents, newest first, fetched one page at a time.
export function useDocuments() {
  const [items, setItems] = useState<Document[]>()
  const [cursor, setCursor] = useState<string>()
  const [error, setError] = useState<ApiErrorCode>()
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    fetchPage().then(
      (page) => {
        setItems(page.items)
        setCursor(page.cursor)
      },
      (err: unknown) => setError(errorCode(err)),
    )
  }, [])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const page = await fetchPage(cursor)
      setItems((current) => [...(current ?? []), ...page.items])
      setCursor(page.cursor)
      setError(undefined)
    } catch (err) {
      setError(errorCode(err))
    } finally {
      setLoadingMore(false)
    }
  }

  return { items, error, hasMore: Boolean(cursor), loadMore, loadingMore }
}
