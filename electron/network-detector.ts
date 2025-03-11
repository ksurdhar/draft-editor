import { ipcMain } from 'electron'
import * as dns from 'dns'

// Network detection timing constants (in milliseconds)
const NETWORK_CHECK_INTERVAL = 30000 // 30 seconds between regular checks

// Track the current online status
let onlineStatus = {
  connected: true,
  lastChecked: Date.now(),
}

/**
 * Initialize network status detection with regular checks
 * Returns a controller with methods to manage the network detection
 * @param options Configuration options for network detection
 */
export const initNetworkDetection = (
  options: {
    enableIntervalChecking?: boolean
  } = {},
) => {
  // Default to enabled interval checking if not specified
  const enableIntervalChecking = options.enableIntervalChecking !== false

  console.log('Initializing network detection:', {
    enableIntervalChecking,
    currentStatus: onlineStatus.connected ? 'online' : 'offline',
  })

  // Base interval - checking every NETWORK_CHECK_INTERVAL
  // Balanced approach between responsiveness and energy usage
  let lastStatus = onlineStatus.connected
  let intervalId: NodeJS.Timeout | null = null

  // Updates and broadcasts network status
  function broadcastNetworkStatus(newStatus: boolean) {
    console.log('broadcastNetworkStatus called with:', newStatus, 'current lastStatus:', lastStatus)

    const statusChanged = newStatus !== lastStatus
    lastStatus = newStatus

    // Update internal status tracking
    onlineStatus.connected = newStatus
    onlineStatus.lastChecked = Date.now()

    // Always broadcast when testing is enabled to ensure UI is updated
    // This helps when the app starts in an incorrect state
    const shouldBroadcast = statusChanged || !enableIntervalChecking

    // If status changed or we're in testing mode, broadcast
    if (shouldBroadcast) {
      console.log(
        `Network status ${statusChanged ? 'changed' : 'being broadcast'}: ${newStatus ? 'online' : 'offline'}`,
      )

      // Clear existing interval if it exists
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }

      // Broadcast status change
      ipcMain.emit('network-status-changed', newStatus)

      // Only set up intervals if enabled
      if (enableIntervalChecking) {
        // If we just detected offline, check more frequently
        if (!newStatus) {
          intervalId = setInterval(checkNetworkStatus, NETWORK_CHECK_INTERVAL / 2)
        } else {
          // Otherwise restore normal interval
          intervalId = setInterval(checkNetworkStatus, NETWORK_CHECK_INTERVAL)
        }
      }
    }
  }

  function checkNetworkStatus() {
    updateOnlineStatus()
      .then(isOnline => {
        // Use our new central broadcast function
        broadcastNetworkStatus(isOnline)
      })
      .catch(console.error)
  }

  // Set up the regular interval if enabled
  if (enableIntervalChecking) {
    console.log('Setting up automatic network status checks')
    intervalId = setInterval(checkNetworkStatus, NETWORK_CHECK_INTERVAL)
  } else {
    console.log('Automatic network status checking is disabled')
  }

  // Do an initial check immediately regardless of interval setting
  checkNetworkStatus()

  return {
    checkNow: checkNetworkStatus,
    // Allow external services to report network failures
    reportNetworkFailure: () => {
      console.log('External service reported network failure')
      broadcastNetworkStatus(false)
    },
  }
}

/**
 * Update the online status using different detection methods
 * Returns the current connectivity status
 */
const updateOnlineStatus = async (): Promise<boolean> => {
  try {
    // First check: Use a system-level check if available
    const wasOnline = onlineStatus.connected

    // Check connection with actual request
    onlineStatus.connected = await performConnectivityCheck()

    // Log changes in connection status
    if (wasOnline !== onlineStatus.connected) {
      console.log(`Network status changed: ${onlineStatus.connected ? 'Online' : 'Offline'}`)
    }

    // Update the last checked timestamp
    onlineStatus.lastChecked = Date.now()

    return onlineStatus.connected
  } catch (error) {
    console.error('Error detecting network status:', error)
    return false
  }
}

/**
 * Perform a lightweight connectivity check
 * Uses multiple methods to verify connectivity with fallbacks
 */
const performConnectivityCheck = async (): Promise<boolean> => {
  // List of common reliable domains to check
  const domainChecks = ['google.com', 'whetstone-writer.com', 'apple.com', 'cloudflare.com']

  console.log('Performing connectivity check against multiple domains')

  // Try DNS lookups for each domain
  for (const domain of domainChecks) {
    try {
      console.log(`Checking connectivity with DNS lookup for ${domain}`)

      const dnsPromise = new Promise<boolean>((resolve, reject) => {
        dns.lookup(domain, err => {
          if (err) {
            reject(err)
          } else {
            resolve(true)
          }
        })
      })

      // Add a timeout to the DNS lookup
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('DNS lookup timeout')), 2000)
      })

      // Race the DNS lookup against the timeout
      const dnsResult = await Promise.race([dnsPromise, timeoutPromise])

      // If DNS check succeeds for any domain, we have connectivity
      if (dnsResult) {
        console.log(`DNS lookup success for ${domain}, network is online`)
        return true
      }
    } catch (dnsError) {
      console.log(`DNS lookup failed for ${domain}:`, dnsError)
      // Continue to the next domain
    }
  }

  // If all DNS lookups fail, try HTTP request as a last resort
  try {
    // Try a lightweight HTTP request to a reliable service
    const pingUrl = 'https://www.google.com'
    console.log('Falling back to HTTP check:', pingUrl)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(pingUrl, {
      method: 'HEAD', // HEAD is perfect for ping - no response body
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      console.log('HTTP check succeeded, network is online')
      return true
    } else {
      console.log('HTTP check failed with status:', response.status)
    }
  } catch (httpError) {
    console.error('HTTP check failed:', httpError)
  }

  console.log('All connectivity checks failed, network is offline')
  return false
}

/**
 * Check if we're online using cached status
 * Triggers a background update if status is stale
 */
export const isOnline = (): boolean => {
  // If it's been more than 30 seconds since last check, update the status
  if (Date.now() - onlineStatus.lastChecked > 30000) {
    // Schedule an async update but don't wait for it
    updateOnlineStatus().catch(console.error)
  }

  // Return the current cached status
  return onlineStatus.connected
}
