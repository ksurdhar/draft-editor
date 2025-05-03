import { DialogueDetection, ProcessedDialogueMark } from '../lib/utils/dialogue-utils'

const sampleDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'This is a sample document with dialogue.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'John: Hello there!',
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'John',
                conversationId: 'test-doc-conv1',
                conversationName: 'Greeting',
                userConfirmed: true,
              },
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Sarah: Hi John, how are you today?',
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'Sarah',
                conversationId: 'test-doc-conv1',
                conversationName: 'Greeting',
                userConfirmed: false,
              },
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'This is not dialogue.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'John: I am doing well, thanks for asking!',
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'John',
                conversationId: 'test-doc-conv1',
                conversationName: 'Greeting',
                userConfirmed: false,
              },
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Michael: Hello everyone, this is a different conversation.',
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'Michael',
                conversationId: 'test-doc-conv2',
                conversationName: null,
                userConfirmed: true,
              },
            },
          ],
        },
      ],
    },
  ],
}

// Sample document with adjacent dialogue nodes
const sampleDocumentWithAdjacentDialogue = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'This is a sample document with adjacent dialogue nodes.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'John: This is part 1',
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'John',
                conversationId: 'test-doc-conv1',
                conversationName: 'Greeting',
                userConfirmed: true,
              },
            },
          ],
        },
        {
          type: 'text',
          text: " of John's dialogue.",
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'John',
                conversationId: 'test-doc-conv1',
                conversationName: 'Greeting',
                userConfirmed: true,
              },
            },
          ],
        },
      ],
    },
  ],
}

// Sample document with no confirmed marks
const sampleDocumentNoConfirmed = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'This is a sample document with dialogue.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'John: Hello there!',
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'John',
                conversationId: 'test-doc-conv1',
                conversationName: 'Greeting',
                userConfirmed: false,
              },
            },
          ],
        },
      ],
    },
  ],
}

// Sample dialogue detection response from API
const sampleDetectedDialogues: DialogueDetection[] = [
  {
    character: 'John',
    snippet: 'John: Hello there!',
    conversationId: 'conv1',
  },
  {
    character: 'Sarah',
    snippet: 'Sarah: Hi John, how are you today?',
    conversationId: 'conv1',
  },
  {
    character: 'John',
    snippet: 'John: I am doing well, thanks for asking!',
    conversationId: 'conv1',
  },
  {
    character: 'Michael',
    snippet: 'Michael: Hello everyone, this is a different conversation.',
    conversationId: 'conv2',
  },
  {
    character: 'Lisa',
    snippet: 'Lisa: This is a new line of dialogue not in the document yet.',
    conversationId: 'conv1',
  },
]

const doc1DetectedDialogues: DialogueDetection[] = [
  {
    character: 'Kyhia',
    snippet: 'Come on you bastard,',
    conversationId: 'conv1',
  },
  {
    character: 'Kyhia',
    snippet: 'Hello?',
    conversationId: 'conv1',
  },
  {
    character: 'Kyhia',
    snippet: 'Are you there, Fire?',
    conversationId: 'conv1',
  },
  {
    character: 'Dark Voice',
    snippet: 'What did you expect? Did you really think it was going to start speaking back to you?',
    conversationId: 'conv1',
  },
  {
    character: 'Dark Voice',
    snippet: 'You’re losing grip, girl. You’re going completely mad.',
    conversationId: 'conv1',
  },
  {
    character: 'Kyhia',
    snippet: 'Whoever’s there, show yourself, or I start shooting,',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet: 'Not one step closer,',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'What fortune we meet again, eh?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Funny meeting you here — how fortuitous',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'You’re the one from Rumor’s!',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Are you following me?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'You—just intruded into my camp.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'You were in Rumor & Mills.',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet: 'Where’s your ship?',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet: 'Crew kick you out?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'What? What are you talking about?',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet: 'Your clothes. That cloak—those are sailing raiments.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Go away.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'No. What are you doing here?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Minding my own damn business.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'You do know its like, supah dangerous in here, right?',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet:
      'And that it’s completely against The Prophet’s Law to travel through here without a priest’s blessing?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'As in, if Halcyon finds you in here they’ll string you up like that. No trial or nothing.',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet:
      'I don’t even know who or what this Halcyon is everyone keeps mentioning, and I really don’t care, so I’d appreciate it if you would just—',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Hang on—who are you?',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet: 'Who are you, and what do you want?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'How in fuck’s beard did you manage to start a fire?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Oh, settle down, Spikes, I’m not about huck the dang thing.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'May I?',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet: 'You didn’t answer my question.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'August X, grovechaser extraordinaire.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Ta,',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'I’m serious, howd’ja do it? I tried for about an hour before all my attempts fizzled out.',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet: 'I chipped off southern facing bark on older pines to start it.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'I’m impressed.',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet:
      'What business does a girl wearing sailor’s raiments have in The Forest / The Wilds? Shouldn’t you be swimming somewhere off the western coast looking for fallen stars?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'I’m trying to reach the Vale of Alasair,',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'My mother is sick and needs medicine from their alchemists.',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet: 'And is your boat broken? Did your crew kick you out?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Well,',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet:
      'For a sailor you make a pretty good fire. I can see how a crew might not want you on the ship. Might make a crew nervous to have you around.',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet: 'My turn,',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet: 'What are you doing here?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Why, fortune seeking of course.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet:
      'Forget it, I should know bettah than to ask someone who visits Rumor’s. What kind of provincal backwater did you bumble from that you haven’t heard of grovechasing?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Seriously?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Rare woods? A religious empire building a tower into heaven needs heaps of rare woods?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'None of this is ringing any bells for you?',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet: 'What?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'You keep staring at me like I’ve sprouted wings or something,',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'But I’m pretty certain between the two of us, you’re the odd duck.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'We should travel together,',
    conversationId: 'conv2',
  },
  {
    character: 'Kyhia',
    snippet: 'Why?',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'First, I can tell that you’re lost, and I have a wayfinder.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'I am not,',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Second, you make a mean fire.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Third, we’re both criminals,',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'Honestly, your firemaking skills are wicked well if nothing else, you make a mean fire.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet: 'but to be honest, I’m enchanted by your strangeness. you’re wild odd, lady.',
    conversationId: 'conv2',
  },
  {
    character: 'Blonde Woman',
    snippet:
      'well, for one, we’re both outlaws now. law breakers should stick together. thick as thieves right?',
    conversationId: 'conv2',
  },
]

// Sample processed dialogues
const sampleProcessedDialogues = [
  {
    character: 'John',
    snippet: 'John: Hello there!',
    conversationId: 'conv1',
    uniqueConversationId: 'test-doc-conv1',
    conversationName: 'Greeting Conversation',
  },
  {
    character: 'Sarah',
    snippet: 'Sarah: Hi John, how are you today?',
    conversationId: 'conv1',
    uniqueConversationId: 'test-doc-conv1',
    conversationName: 'Greeting Conversation',
  },
  {
    character: 'Lisa',
    snippet: 'Lisa: This is a new line of dialogue not in the document yet.',
    conversationId: 'conv1',
    uniqueConversationId: 'test-doc-conv1',
    conversationName: 'Greeting Conversation',
  },
]

// Sample processed dialogue marks
const sampleProcessedMarks: ProcessedDialogueMark[] = [
  {
    id: '60-80',
    character: 'John',
    content: 'John: Hello there!',
    conversationId: 'test-doc-conv1',
    conversationName: 'Greeting',
    userConfirmed: true,
  },
  {
    id: '100-135',
    character: 'Sarah',
    content: 'Sarah: Hi John, how are you today?',
    conversationId: 'test-doc-conv1',
    conversationName: 'Greeting',
    userConfirmed: false,
  },
  {
    id: '180-220',
    character: 'John',
    content: 'John: I am doing well, thanks for asking!',
    conversationId: 'test-doc-conv1',
    conversationName: 'Greeting',
    userConfirmed: false,
  },
  {
    id: '240-300',
    character: 'Michael',
    content: 'Michael: Hello everyone, this is a different conversation.',
    conversationId: 'test-doc-conv2',
    conversationName: null,
    userConfirmed: true,
  },
]

const sampleDoc1 = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Chapter',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\t',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '\tWhen her eyes opened to the realm of the living, she was still in the forest.',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\tShe felt afraid and deeply alone. In her desperation and loneliness.',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'she thought of the friendly voice she had heard of the fire. Perhaps—perhaps there was a way to summon a friend.',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'She wondered whether she could speak with it again, so she went about building one. She worked with the diligence of one might clean their home to welcome a vistor. She would welcome a vistor now. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Whether her shivers were caused by the cold grasp of night or the dregs of her nightmare, Kyhia could not say. She feared sleep. Sleep, it seemed, left her powerless to defend herself against the madness within. So instead, she built a fire, though the fire did not want to be built; the ground was wet and the moisture forest worked against her. Against all odds, it sputtered into life, releasing lazy streams of reticent white smoke.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'It sputtered and complained at first. “Come on you bastard,” she muttered. Before long, her restlessness had forge a roaring blaze. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'She bit her lip, staring into the flames. “Hello?” she attempted.',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '“Are you there, Fire?”',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\tBut the fire did not speak back. Instead, a dark voice in the back of her head rose.',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\tWhat did you expect? Did you really think it was going to start speaking back to you? ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\tShe hung her head as the fire flickered.',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'You’re losing grip, girl. You’re going completely mad. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '\tShe sat cross legged, placed her bow across her lap, and meditated, in hopes of quieting her inner demons and catching some form of rest.',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'She tightened her grip around her flint, ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'crossed her legs and began to meditate',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'in hopes of silencing the inner voices, caging her demons',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'she tried using her attention to excise the rotten part of her',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'which made her this way.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Before long she began to drowse, and exhaustion caught up to her. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '\tKyhia opened her eyes and everything was monochromatic dark blue. Kyhia’s sleep came in flickers slapdash intermittent, frequently interrupted. Nightmares of sinking below the ocean, but this time there was no eyes, no silhouettes, no floating beasts. She was alone as she sank. She floated for what seemed like an eternity, before her feet finally reached what must have been the ocean floor; barren and lifeless.',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\tIn the distance, were mountains, the very same which mocked her as she left Gomyr. And there at the bottom her tribe flickered into view around her; forming a circle, but with their backs facing her. Her mother, her father, Gaho, the other vigilant. Their hair floated in halftime under the water as though the wind moved through them, currents but of a different sort, moving twice as slowly, and one by one they turned around ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'and Kyhia curled into a ball and cried. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '\tIt was a nightmare of sorts; but a quiet one. She was snapped from her reverie by the sound of a twig crunching. But no one snuck up on an Aranoah.',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'In a whirl, Kyhia was on her feet, bow and arrow in hand. ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\t“Whoever’s there, show yourself, or I start shooting,” she tried to say confidently, though her voice nearly tripped in her throat. Hoarse from sleep. Behind a tree sidled a blonde woman with tired eyes she had seen storm out of Rumor & Mills the day prior, a dagger balanced in hand.',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\t“Not one step closer,” Kyhia warned, an arrow in fist, fully nocked back. The woman grinned in recognition and lowered her weapon. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“What fortune we meet again, eh?”',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '“Funny meeting you here — how fortuitous ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '“You’re the one from Rumor’s!”',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'star crossed ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'are you following me? She said, her demeanor coy.',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'do I have a fan?',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Are you following me? She asked with narrowed eyes.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'You—just intruded into my camp.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'You were in Rumor & Mills.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Kyhia s',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Where’s your ship?',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'Crew kick you out?',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'What? What are you talking about?',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Your clothes. That cloak—those are sailing raiments.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Go away. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'No. What are you doing here?',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Minding my own damn business.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'You do know its like, supah dangerous in here, right?',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Kyhia shrugged. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“And that it’s completely against The Prophet’s Law to travel through here without a priest’s blessing?” Kyhia said nothing. She continued. “As in, if Halcyon finds you in here they’ll string you up like that. No trial or nothing. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“I don’t even know who or what this Halcyon is everyone keeps mentioning, and I really don’t care, so I’d appreciate it if you would just—“',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“Hang on—who are you?”',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'August sat down next to her, a curious grin flashed across her face.  ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'She chewed on her lip as though trying to make up her mind. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'She was incredibly annoying, but also quite cute. ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'Kyhia was internally navigating whether she wanted her attention or ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: ' wanted her attention. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Later on,',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Honestly, I just',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'How do you know I’m not a threat? Steal whatever’s in that satchel of yours?',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'August only smiled ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“Who are you, and what do you want?” asked Kyhia, tersely.  Exhaustion did nothing to help her mood.',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\t“How in fuck’s beard did you manage to start a fire?”',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\tKyhia kept her bow trained on the woman, eyes flickered to the weapon in her hand and then back to her face. ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\t“Oh, settle down, Spikes, I’m not about huck the dang thing.” She placed her knife back in its sheath. “May I?” she asked, nodding towards the fire. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '\t“You didn’t answer my question.”',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\t“August X, grovechaser extraordinaire.”',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '\tKyhia wanted nothing more than to be alone, but dammit if her smile wasn’t lovely—teeth like perfect marble—and her voice came out with a musical lilt. She reminded Kyhia of a sculpture of a hero the stonemasons of her tribe would carve—albeit, an exhausted looking one with those rings around her eyes. Kyhia lowered her bow, though she did not stow it. She sat down but was remained on guard.',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\t“Ta,” she said with a smile, and sat across from Kyhia. She made herself comfortable instantly, lounging as though she were in the safety of her home, and not at all somewhere dangerous. She reveled in the warmth and rubbing her hands together. She looked as though she’d always been here.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“I’m serious, howd’ja do it? I tried for about an hour before all my attempts fizzled out.”',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“I chipped off southern facing bark on older pines to start it.”',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“I’m impressed.”',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '\t“What business does a girl wearing sailor’s raiments have in The Forest / The Wilds? Shouldn’t you be swimming somewhere off the western coast looking for fallen stars?”',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\t She spread her arms as if to capture the forest, with the same strange emphasis that everyone else had. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '\t“I’m trying to reach the Vale of Alasair,” she said, finally. “My mother is sick and needs medicine from their alchemists.”',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\t“And is your boat broken? Did your crew kick you out?”',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '\t“Well,” August said as she kicked her feet, “For a sailor you make a pretty good fire. I can see how a crew might not want you on the ship. Might make a crew nervous to have you around.”',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“My turn,” said Kyhia. “What are you doing here?”',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“Why, fortune seeking of course.”',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Forget it, I should know bettah than to ask someone who visits Rumor’s. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'What kind of provincal backwater did you bumble from that you haven’t heard of grovechasing?',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'Seriously?',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Rare woods? A religious empire building a tower into heaven needs heaps of rare woods?',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'None of this is ringing any bells for you?',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '\tShe pulled out a pipe, filled it with weed and lit the end with a branch from the fire. Her tired, ringed eyes bore holes into Kyhia as she noiselessly blew rings of smoke into the air. A slow smile spread across her face which caused Kyhia’s stomach to squirm. ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\t“What?” Kyhia finally asked. ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\t“You keep staring at me like I’ve sprouted wings or something,” she said. She used her pipe to point at Kyhia. “But I’m pretty certain between the two of us, you’re the odd duck.”',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: '\tKyhia turned away, and softened her gaze, internally scolding herself for acting so foreign. ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'Her next comment caught Kyhia off guard. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“We should travel together,” the August suggested.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Why? asked Kyhia, her eyes narrowed with suspicion.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“First, I can tell that you’re lost, and I have a wayfinder.”',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'She flipped a silver compass before showing it to Kyhia.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“I am not,” said Kyhia. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'You’re gonna lie to me and say that ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'You look about at home in the forest as a ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“Second, you make a mean fire.”',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '“Third, we’re both criminals, ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Honestly, your firemaking skills are wicked ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'well if nothing else, you make a mean fire. she said with a grin.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'but to be honest, I’m enchanted by your strangeness. ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'you’re wild odd, lady. ',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'well, for one, we’re both outlaws now. ',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'law breakers should stick together. thick as thieves right?',
        },
      ],
    },
  ],
}

export {
  sampleDocument,
  sampleDocumentWithAdjacentDialogue,
  sampleDocumentNoConfirmed,
  sampleDetectedDialogues,
  sampleProcessedDialogues,
  sampleProcessedMarks,
  sampleDoc1,
  doc1DetectedDialogues,
}
