interface LogEntry {
  timestamp: Date
  message: string
  data?: any
}

// Simple in-memory store for logs
const logStore: LogEntry[] = []

// Function to add a log entry
export function debugLog(message: string, data?: any): void {
  const entry: LogEntry = {
    timestamp: new Date(),
    message,
    ...(data !== undefined && { data }), // Conditionally add data if provided
  }
  logStore.push(entry)
  // Optional: Limit the log store size to prevent memory issues
  // if (logStore.length > 500) {
  //   logStore.shift(); // Remove the oldest entry
  // }
  // In a more complex app, might emit an event here
}

// Function to retrieve all log entries
export function getDebugLogs(): LogEntry[] {
  // Return a copy to prevent direct modification of the store
  return [...logStore]
}

// Function to clear logs (optional)
export function clearDebugLogs(): void {
  logStore.length = 0
}
