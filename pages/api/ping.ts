import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Simple ping endpoint to check API availability
 * Used for connectivity detection in the Electron app
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Return a 204 No Content response - perfect for ping checks
  // (even lighter than 200 OK since it has no body)
  res.status(204).end()
}
