import crypto from 'crypto'

// Fields to exclude when computing hash
const EXCLUDED_FIELDS = ['hash', 'lastUpdated', 'updatedAt', '_id', 'id']

/**
 * Stable stringify that sorts object keys to ensure consistent output
 * regardless of key order in the original object
 */
export function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']'
  }

  // Sort keys and create a new object with them in sorted order
  const sortedKeys = Object.keys(obj).sort()

  const pairs = sortedKeys
    .filter(key => !EXCLUDED_FIELDS.includes(key) && obj[key] !== undefined)
    .map(key => JSON.stringify(key) + ':' + stableStringify(obj[key]))

  return '{' + pairs.join(',') + '}'
}

/**
 * Computes a deterministic hash for an entity
 *
 * @param entity The entity to hash
 * @param algorithm Hash algorithm to use ('sha256' by default, can also use 'xxhash64')
 * @returns A hash string
 */
export function computeEntityHash(entity: any, algorithm: 'sha256' | 'xxhash64' = 'sha256'): string {
  // We first need to get a stable string representation of the entity
  const stableStr = stableStringify(entity)

  // Then compute the hash
  if (algorithm === 'xxhash64') {
    // xxHash is not built into Node.js, so we'd need to use a library
    // For simplicity, we're using sha256 here
    console.warn('xxhash64 requested but not implemented, falling back to sha256')
    algorithm = 'sha256'
  }

  return crypto.createHash(algorithm).update(stableStr).digest('hex')
}

/**
 * Computes and adds hash to an entity
 *
 * @param entity The entity to hash and update
 * @param algorithm Hash algorithm to use ('sha256' by default, can also use 'xxhash64')
 * @returns The updated entity with hash field
 */
export function addHashToEntity<T extends object>(
  entity: T,
  algorithm: 'sha256' | 'xxhash64' = 'sha256',
): T & { hash: string } {
  const hash = computeEntityHash(entity, algorithm)
  return { ...entity, hash }
}

export default computeEntityHash
