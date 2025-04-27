interface LogEntry {
  timestamp: Date
  message: string
  data?: any
  group: string // New field to specify which group/tab the log belongs to
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
export function debugLog(message: string, data?: any, group = 'general'): void {
  const entry: LogEntry = {
    timestamp: new Date(),
    message,
    group,
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

// Function to get all unique log groups
export function getLogGroups(): string[] {
  const groups = new Set(logStore.map(log => log.group))
  return Array.from(groups)
}

// Function to clear logs from a specific group
export function clearLogGroup(group: string): void {
  // If group is 'general', clear all logs
  if (group === 'general') {
    clearDebugLogs()
    return
  }

  // Remove logs matching the specified group
  const filteredLogs = logStore.filter(log => log.group !== group)
  logStore.length = 0
  filteredLogs.forEach(log => logStore.push(log))
  notifyListeners()
}
