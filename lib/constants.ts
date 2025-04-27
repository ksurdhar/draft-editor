export const DEFAULT_DOCUMENT_CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '',
        },
      ],
    },
  ],
} as const

export const DEFAULT_DOCUMENT_TITLE = 'Untitled'

// AI models configuration
export type ModelInfo = {
  id: string
  name: string
}

export const AI_MODELS = {
  openai: [{ id: 'gpt-4o', name: 'GPT-4o' }],
  // google: [
  //   { id: 'gemini-2.5-flash-preview-04-17', name: 'Gemini 2.5 Flash' },
  //   { id: 'gemini-2.5-pro-preview-03-25', name: 'Gemini 2.5 Pro' },
  // ],
  anthropic: [
    { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
  ],
}

// Helper function to get provider from model ID
export function getProviderFromModel(model: string): 'openai' | 'google' | 'anthropic' {
  const openaiModels = AI_MODELS.openai.map(m => m.id)
  const anthropicModels = AI_MODELS.anthropic.map(m => m.id)
  // const googleModels = AI_MODELS.google.map(m => m.id)

  if (openaiModels.includes(model)) return 'openai'
  if (anthropicModels.includes(model)) return 'anthropic'
  // if (googleModels.includes(model)) return 'google'

  // Default to OpenAI
  return 'openai'
}
