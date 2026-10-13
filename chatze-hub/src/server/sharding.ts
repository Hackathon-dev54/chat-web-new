import type { HubBindings } from './types'

/**
 * 32-bit FNV-1a Hash Algorithm
 * Fast, uniform dispersion across integer buckets for sharding.
 */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return hash >>> 0
}

/**
 * Resolves which of the 8 user D1 database shards (DB_USERS_0 to DB_USERS_7)
 * holds the record for a given Google Sub ID.
 */
export function getUserShardIndex(googleSub: string): number {
  const hash = fnv1a(googleSub)
  return hash % 8
}

/**
 * Retrieves the D1 database binding for a specific Google Sub ID.
 */
export function getUserDbShard(googleSub: string, env: HubBindings): any {
  const index = getUserShardIndex(googleSub)
  const shards = [
    env.DB_USERS_0,
    env.DB_USERS_1,
    env.DB_USERS_2,
    env.DB_USERS_3,
    env.DB_USERS_4,
    env.DB_USERS_5,
    env.DB_USERS_6,
    env.DB_USERS_7,
  ]
  return shards[index] || env.DB_USERS_0
}
