import { useQuery } from '@tanstack/react-query'
import { authApi } from './api'
import type { User } from './types'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    staleTime: 30_000,
    retry: false,
  })
}

export function useCurrentUser(): User | undefined {
  return useMe().data?.user
}

export function isAdmin(user: User | undefined) {
  return user?.role === 'ADMIN'
}