# Dialogue Detection and Naming

This document describes the dialogue detection and naming system used in the application.

## Two-Pass Pipeline

The dialogue detection system works in a two-pass pipeline:

1. **Pass 1 (Detection)**: Uses AI to detect dialogue in text, identify speakers, and group conversations.
2. **Pass 2 (Naming)**: Assigns human-readable names to conversations based on dialogue content.

### Pass 1: Dialogue Detection

The first pass identifies dialogue snippets in the text with the following steps:

1. Collects confirmed character names to improve speaker attribution
2. Sends text to the AI model for dialogue detection
3. Receives dialogue snippets with character assignments and conversation groupings

Features of the dialogue detection:

- Uses turn-taking context for better speaker attribution when explicit hints are missing
- Assigns confidence scores (≤0.60) for inferred speakers
- Handles interrupted speech correctly
- Preserves user-confirmed character assignments and conversation groups

### Pass 2: Conversation Naming

The second pass generates descriptive names for each conversation:

1. Groups dialogue snippets by conversation ID
2. Sends conversation snippets to the naming API
3. Receives human-readable names (≤60 characters) for each conversation
4. Applies these names to dialogue marks in the editor

## API Endpoints

### `/dialogue/detect`

Detects dialogue sections in text.

**Request:**

```json
{
  "text": "...",
  "knownCharacters": ["Character1", "Character2"]
}
```

**Response:**

```json
{
  "dialogues": [
    {
      "character": "Character1",
      "confidence": 0.95,
      "snippet": "Hello there!",
      "conversationId": "conv1"
    },
    ...
  ]
}
```

### `/dialogue/name-conversations`

Generates names for conversations based on dialogue snippets.

**Request:**

```json
{
  "conversations": [
    {
      "id": "conv1",
      "snippets": ["Hello there!", "General Kenobi!"]
    },
    ...
  ]
}
```

**Response:**

```json
{
  "names": [
    {
      "id": "conv1",
      "name": "Jedi Greeting",
      "confidence": 0.9
    },
    ...
  ]
}
```

## Environment Variables

- `OPENAI_API_KEY`: Required for AI model access

## Troubleshooting

If dialogue detection quality degrades:

1. Check the system prompts in the API endpoints
2. Try adjusting temperature values (lower for more deterministic results)
3. Consider upgrading to a more capable model version
4. Ensure the `knownCharacters` array is being properly populated from confirmed dialogues

For naming quality issues:

1. Check the naming prompt in the name-conversations endpoint
2. Adjust the temperature value
3. Consider providing more context in the conversation snippets

## Future Improvements

Potential enhancements to consider:

1. Character relationship mapping
2. Scene detection and boundary identification
3. Dialogue style analysis
4. Sentiment tracking across conversations
5. Adaptive confidence thresholds based on user feedback
