import { ipcMain } from 'electron'
import * as dns from 'dns'

// Base URL for the API
const BASE_URL = 'https://www.whetstone-writer.com/api'

// Track the current online status
let onlineStatus = {
  connected: true,
  lastChecked: Date.now(),
}

/**
 * Initialize network status detection with regular checks
 * Returns a controller with methods to manage the network detection
 */
export const initNetworkDetection = () => {
  // Base interval - checking every 30 seconds
  // Balanced approach between responsiveness and energy usage
  let lastStatus = onlineStatus.connected
  let intervalId: NodeJS.Timeout

  function checkNetworkStatus() {
    updateOnlineStatus()
      .then(isOnline => {
        const statusChanged = isOnline !== lastStatus
        lastStatus = isOnline

        // If status changed, temporarily increase check frequency
        if (statusChanged) {
          // Clear existing interval
          if (intervalId) clearInterval(intervalId)

          // Check again sooner (10s) to verify the change wasn't temporary
          setTimeout(() => {
            updateOnlineStatus()
              .then(newStatus => {
                // Broadcast the confirmed status
                ipcMain.emit('network-status-changed', newStatus)

                // Restore normal interval
                if (intervalId) clearInterval(intervalId)
                intervalId = setInterval(checkNetworkStatus, 30000)
              })
              .catch(console.error)
          }, 10000)

          // Broadcast immediate status change
          ipcMain.emit('network-status-changed', isOnline)
        }
      })
      .catch(console.error)
  }

  // Set up the regular interval
  intervalId = setInterval(checkNetworkStatus, 30000)

  // Do an initial check immediately
  checkNetworkStatus()

  // Also expose a method to manually check network status
  // This can be called after resuming from sleep, etc.
  return {
    checkNow: checkNetworkStatus,
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
  try {
    // First attempt: Try to resolve a hostname (DNS lookup)
    // This is lightweight and uses minimal resources
    console.log('Checking connectivity with DNS lookup for whetstone-writer.com')

    const dnsPromise = new Promise<boolean>((resolve, reject) => {
      dns.lookup('whetstone-writer.com', err => {
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

    // If DNS check succeeds, we have connectivity
    if (dnsResult) {
      return true
    }
  } catch (dnsError) {
    console.log('DNS lookup failed:', dnsError)
    // DNS check failed, continue to HTTP check
  }

  try {
    // Second attempt: Try a lightweight HTTP request to our API
    // This is more reliable but has more overhead
    const pingUrl = `${BASE_URL}/ping`
    console.log('Falling back to ping endpoint:', pingUrl)

    const response = await fetch(pingUrl, {
      method: 'HEAD', // HEAD is perfect for ping - no response body
      cache: 'no-store', // Don't cache results
      // Short timeout to avoid hanging
      signal: AbortSignal.timeout(2000),
    })

    // Any successful response (2xx) indicates connectivity
    return response.ok
  } catch (httpError) {
    // Both checks failed, likely offline
    console.log('All connectivity checks failed, assuming offline')
    return false
  }
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
