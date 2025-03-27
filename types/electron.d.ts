import { DialogueDetectionResult } from '@lib/dialogue-service'

declare global {
  interface Window {
    electron: {
      detectDialogue: (text: string) => Promise<DialogueDetectionResult[]>
      // ... other electron methods
    }
    process?: {
      type: string
    }
  }
}

export interface DialogueDetectionResult {
  character: string
  confidence: number
  snippet: string
  conversationId: string
}
