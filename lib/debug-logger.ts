interface LogEntry {
  timestamp: Date
  message: string
  data?: any
}

// Event system for real-time log updates
type LogListener = (logs: LogEntry[]) => void
const listeners: Set<LogListener> = new Set()

// Simple in-memory store for logs
const logStore: LogEntry[] = []

// Function to subscribe to log updates
export function subscribeToLogs(listener: LogListener): () => void {
  listeners.add(listener)
  // Return cleanup function
  return () => {
    listeners.delete(listener)
  }
}

// Notify all listeners
function notifyListeners() {
  const currentLogs = [...logStore]
  listeners.forEach(listener => listener(currentLogs))
}

// Function to add a log entry
export function debugLog(message: string, data?: any): void {
  const entry: LogEntry = {
    timestamp: new Date(),
    message,
    ...(data !== undefined && { data }), // Conditionally add data if provided
  }
  logStore.push(entry)

  // Notify listeners of the update
  notifyListeners()

  // Optional: Limit the log store size to prevent memory issues
  // if (logStore.length > 500) {
  //   logStore.shift(); // Remove the oldest entry
  // }
}

// Function to retrieve all log entries
export function getDebugLogs(): LogEntry[] {
  // Return a copy to prevent direct modification of the store
  return [...logStore]
}

// Function to clear logs
export function clearDebugLogs(): void {
  logStore.length = 0
  // Notify listeners that logs were cleared
  notifyListeners()
}
