export interface DialogueDetectionResult {
  character: string
  confidence: number
  text: string
  startIndex: number
  endIndex: number
  context?: string
}

class DialogueService {
  private isElectron: boolean

  constructor() {
    // Check if we're in Electron environment
    this.isElectron = typeof window !== 'undefined' && window.process?.type === 'renderer'
  }

  async detectDialogue(text: string): Promise<DialogueDetectionResult[]> {
    try {
      if (this.isElectron) {
        // Use Electron IPC
        return await window.electron.detectDialogue(text)
      } else {
        // Use Next.js API route
        const response = await fetch('/api/dialogue/detect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.message || 'Failed to detect dialogue')
        }

        const data = await response.json()
        return data.dialogues
      }
    } catch (error) {
      console.error('Error detecting dialogue:', error)
      throw error
    }
  }
}

export const dialogueService = new DialogueService()
