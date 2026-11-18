import { useQuery } from '@tanstack/react-query'
import type { ReadUse, StorageUse } from 'shared'
import { api } from '~/shared/lib/api.ts'

export const readsKey = ['reads']

// The account's readings with AI this month against its limit, with how many are left.
export const useReadUse = () =>
  useQuery({
    queryKey: readsKey,
    queryFn: () => api.get<ReadUse>('/documents/reads'),
    select: (use) => ({ ...use, left: Math.max(0, use.limit - use.used) }),
  })

// How much of the account's storage its files take.
export const useStorageUse = () =>
  useQuery({ queryKey: ['storage'], queryFn: () => api.get<StorageUse>('/documents/storage') })
