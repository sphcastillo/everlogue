import 'server-only'
import {catalogCached, catalogClient, catalogRevalidate} from './client'

export async function fetchCatalog<T>(query: string, params: Record<string, unknown> = {}) {
  return catalogClient.fetch<T>(query, params, catalogRevalidate)
}

export async function fetchCachedCatalog<T>(query: string, params: Record<string, unknown> = {}) {
  return catalogClient.fetch<T>(query, params, catalogCached)
}
