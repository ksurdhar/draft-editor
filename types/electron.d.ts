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
