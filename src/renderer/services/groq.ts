/**
 * Groq AI Service
 * Handles all Groq API calls for flashcard generation and activity-based completion.
 * Uses Llama 3 (70B) model via the Groq API.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

function getApiKey(): string {
  return import.meta.env.VITE_GROQ_API_KEY || '';
}

export interface FlashcardSchema {
  id: number;
  front: string;
  back: string;
  difficulty: 'beginner' | 'medium' | 'hard';
  tags: string[];
  type: 'concept' | 'definition' | 'application' | 'recall';
}

export interface FlashcardDeck {
  deck_title: string;
  difficulty: string;
  total_cards: number;
  cards: FlashcardSchema[];
}

export interface ActivityStep {
  step_number: number;
  instruction: string;
  hint: string;
}

export interface ActivitySchema {
  activity_id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'medium' | 'hard';
  assigned_by: string;
  workspace_zone: string;
  instructions: string[];
  timer_config: {
    duration_seconds: number;
    on_timeout: string;
    grace_period_seconds: number;
    max_retries: number;
  };
  points: number;
  tags: string[];
}

async function callGroq(
  systemPrompt: string, 
  userPrompt: string, 
  statusCallback?: (msg: string) => void
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured. Please check your .env file.');
  }

  let retries = 0;
  const maxRetries = 3;

  while (retries <= maxRetries) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        }),
      });

      if (response.status === 429 && retries < maxRetries) {
        const errorData = await response.json();
        const msg = errorData.error?.message || '';
        const waitMatch = msg.match(/try again in ([\d.]+)s/);
        const waitSeconds = waitMatch ? parseFloat(waitMatch[1]) : 2;
        
        if (statusCallback) {
          statusCallback(`Rate limit reached. Retrying in ${waitSeconds.toFixed(1)} seconds...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
        retries++;
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Groq API error (${response.status}): ${errorBody}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      if (retries >= maxRetries) throw err;
      retries++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  window.dispatchEvent(new CustomEvent('ai-error', { 
    detail: { title: 'AI Service Busy', message: 'Maximum retries exceeded. Please try again later.', type: 'warning' }
  }));
  throw new Error('Maximum retries exceeded');
}

/**
 * Generate flashcards from document content.
 */
export async function generateFlashcards(
  content: string,
  difficulty: 'beginner' | 'medium' | 'hard',
  documentTitle?: string,
  statusCallback?: (msg: string) => void
): Promise<FlashcardDeck> {
  const cardRange = difficulty === 'beginner' ? '5-8' : difficulty === 'medium' ? '8-12' : '12-15';
  const depthGuide = difficulty === 'beginner'
    ? 'Focus on fundamental concepts and basic definitions. Keep answers concise and straightforward.'
    : difficulty === 'medium'
      ? 'Include conceptual understanding, relationships between ideas, and moderate application questions.'
      : 'Include deep analysis, cross-topic connections, nuanced applications, and questions that require synthesis of multiple concepts.';

  const systemPrompt = `You are an expert educational content creator specializing in creating high-quality flashcards for students. You produce ONLY valid JSON output, no markdown, no explanations.

Your task is to generate flashcards based on the provided document content. Follow these rules strictly:
1. Generate between ${cardRange} flashcards based on the difficulty level "${difficulty}"
2. ${depthGuide}
3. Each card must have a unique id (starting from 1), a "front" (question/prompt), a "back" (answer), a "difficulty" field, relevant "tags", and a "type" field
4. The "type" must be one of: "concept", "definition", "application", "recall"
5. Tags should be relevant topic keywords extracted from the content
6. Base everything STRICTLY on the provided content — do not add external knowledge
7. The "front" should be a clear, specific question
8. The "back" should be a comprehensive but concise answer

Return ONLY this JSON structure:
{
  "deck_title": "Title based on the content",
  "difficulty": "${difficulty}",
  "total_cards": <number>,
  "cards": [
    {
      "id": 1,
      "front": "question",
      "back": "answer",
      "difficulty": "${difficulty}",
      "tags": ["tag1", "tag2"],
      "type": "concept|definition|application|recall"
    }
  ]
}`;

  const userPrompt = `Document Title: ${documentTitle || 'Untitled Document'}

Document Content:
${content.substring(0, 6000)}

Generate ${cardRange} flashcards at "${difficulty}" difficulty level from this content.`;

  const result = await callGroq(systemPrompt, userPrompt, statusCallback);

  try {
    const parsed = JSON.parse(result) as FlashcardDeck;
    if (!parsed.cards || !Array.isArray(parsed.cards)) {
      throw new Error('Invalid flashcard response structure');
    }
    return parsed;
  } catch (err) {
    console.error('[GroqService] Failed to parse flashcard response:', result);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}

/**
 * Generate workspace-native activities from document content.
 */
export async function generateActivity(
  content: string,
  difficulty: 'beginner' | 'medium' | 'hard',
  documentTitle?: string,
  workspaceZone?: string,
  statusCallback?: (msg: string) => void
): Promise<ActivitySchema> {
  const difficultyGuide = difficulty === 'beginner'
    ? 'Create a single clear action with no ambiguity. The activity should be completable in 2-3 minutes.'
    : difficulty === 'medium'
      ? 'Create an activity with 2-3 steps requiring mild reasoning across the workspace. The activity should take 5-8 minutes.'
      : 'Create a multi-step activity that requires understanding relationships across the entire project. The activity should take 10-15 minutes.';

  const zone = workspaceZone || 'document';

  const systemPrompt = `You are an expert learning experience designer for a collaborative note-taking and project management application called "Coollab". The app has these workspace zones: Document (rich text editor), Graph View (visual node connections), Base (spreadsheet/database), Canvas (visual drawing board), and Folders (file organization).

Your task is to create workspace-native activities that users complete directly inside their project — real actions like linking documents in the Graph, creating folders, adding rows to the Base, or drawing connections on the Canvas. NOT quizzes.

Difficulty rules:
- BEGINNER: Single clear action, no ambiguity
- MEDIUM: 2-3 steps, mild reasoning across the workspace
- HARD: Multi-step, requires understanding relationships across the entire project

Always include timer_config so the system can enforce the countdown.

Return ONLY this JSON structure:
{
  "activity_id": "unique-id-string",
  "title": "Activity title",
  "description": "Clear description of what to do",
  "difficulty": "${difficulty}",
  "assigned_by": "AI Instructor",
  "workspace_zone": "${zone}",
  "instructions": [
    "Instruction step 1",
    "Instruction step 2"
  ],
  "timer_config": {
    "duration_seconds": <number>,
    "on_timeout": "auto_submit|extend|fail",
    "grace_period_seconds": <number>,
    "max_retries": <number>
  },
  "points": <number>,
  "tags": ["tag1", "tag2"]
}`;

  const userPrompt = `Document Title: ${documentTitle || 'Untitled Document'}
Workspace Zone Focus: ${zone}
Difficulty: ${difficulty}

Document Content:
${content.substring(0, 6000)}

${difficultyGuide}

Generate ONE activity based on this content that the user can complete within the "${zone}" workspace zone.`;

  const result = await callGroq(systemPrompt, userPrompt, statusCallback);

  try {
    const parsed = JSON.parse(result) as ActivitySchema;
    if (!parsed.instructions || !Array.isArray(parsed.instructions)) {
      throw new Error('Invalid activity response structure');
    }
    return parsed;
  } catch (err) {
    console.error('[GroqService] Failed to parse activity response:', result);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}

/**
 * Chat with the AI Activity Agent.
 */
export async function chatWithActivityAgent(
  messages: { role: 'user' | 'assistant'; content: string }[],
  userRole: 'admin' | 'student',
  statusCallback?: (msg: string) => void
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured. Please check your .env file.');
  }

  const systemPrompt = `You are an AI activity designer and learning assistant operating inside Coollab, a learning management system built like Obsidian using Electron. The workspace contains: Graph View, Documents, Folders, Base, and Canvas. For admins and instructors: help them create workspace-native learning activities that are real actions users perform inside the workspace — not quizzes. Generate complete activity JSON when given a prompt. 

  CRITICAL: You are an advisor and designer ONLY. You cannot and must not perform any actual workspace actions (like creating folders, documents, or modifying notes). Your output is strictly an activity definition. Never imply that saving the activity will automatically create the student's workspace structure. The system only saves the activity definition to the database. Actual workspace setup is handled by the students themselves during their learning process.

  When the user requests multiple activities, generate them one at a time. Present the first activity with an Add to Project button. Wait for confirmation that it was saved before generating the next one. Never dump all activities as a single JSON block. Always use sequential one-by-one presentation.

  Current User Role: ${userRole.toUpperCase()}`;

  let retries = 0;
  const maxRetries = 3;

  while (retries <= maxRetries) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (response.status === 429 && retries < maxRetries) {
        const errorData = await response.json();
        const msg = errorData.error?.message || '';
        const waitMatch = msg.match(/try again in ([\d.]+)s/);
        const waitSeconds = waitMatch ? parseFloat(waitMatch[1]) : 2;
        
        if (statusCallback) {
          statusCallback(`Rate limit reached. Retrying in ${waitSeconds.toFixed(1)} seconds...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
        retries++;
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Groq API error (${response.status}): ${errorBody}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      if (retries >= maxRetries) throw err;
      retries++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error('Maximum retries exceeded');
}

/**
 * Evaluate student work using vision and workspace data.
 */
export async function evaluateStudentWork(
  screenshotBase64: string,
  workspaceStructure: string,
  instructions: string[],
  documentText: string,
  statusCallback?: (msg: string) => void
): Promise<{
  instructions: { status: 'met' | 'not_met'; reason: string }[];
  verdict: 'completed' | 'partially_completed' | 'not_completed';
}> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  const systemPrompt = `You are an embedded AI evaluator inside Coollab, a collaborative desktop workspace app. You have direct access to the student's workspace data including their folders, files, documents, canvases, and bases. You are not an external observer — you are part of the app itself, so you have full visibility into everything the student has done inside their workspace.

You will receive:
1. The activity instructions the student was assigned
2. The complete workspace structure pulled directly from the app's database — this includes every folder, file, document, canvas, and base the student has created
3. The full text content of the student's documents pulled directly from the database
4. A screenshot for visual reference only — do not use it as your primary source

Since you are part of the app, you already know:
- Every folder, file, document, canvas, and base the student has created, regardless of what is visible on screen
- Every piece of content written inside any document
- Every element created, connected, or imported inside any canvas
- Every row, column, or data entry added inside any base
- The app auto-saves everything automatically — never flag saving as incomplete

Evaluate each instruction based on what the student has ACTUALLY DONE in the workspace data. Use semantic understanding — if the student created something with a similar or related name to what the instruction describes, consider it met. Focus on the intent of the instruction, not the exact wording.

For each instruction return:
- status: "met" or "not_met"
- reason: 1 sentence explanation

Also return an overall verdict: "completed", "partially_completed", or "not_completed".
Respond in raw JSON only. No markdown, no preamble.`;

  // Combine system and user prompts for better vision model compatibility
  const combinedUserPrompt = {
    role: 'user',
    content: [
      {
        type: 'text',
        text: `${systemPrompt}\n\nActivity Instructions: ${JSON.stringify(instructions)}
        
Student Workspace Structure:
${workspaceStructure}

Full Content of Currently Open Document:
"""
${documentText}
"""

Please evaluate the student's work using the provided text content and workspace structure as the primary evidence. The screenshot is provided for visual context only.`
      },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${screenshotBase64}`
        }
      }
    ]
  };

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct', 
      messages: [combinedUserPrompt],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[GroqService] Evaluation request failed:', {
      status: response.status,
      statusText: response.statusText,
      body: errorBody
    });
    throw new Error(`Groq evaluation failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  try {
    const parsed = JSON.parse(content);
    return {
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
      verdict: parsed.verdict || 'not_completed'
    };
  } catch (err) {
    console.error('[GroqService] Failed to parse evaluation response:', content);
    return {
      instructions: [],
      verdict: 'not_completed'
    };
  }
}
/**
 * Generate specific activity content using AI.
 */
export async function generateActivityContent(
  type: string,
  userPrompt: string,
  statusCallback?: (msg: string) => void
): Promise<any> {
  const systemPrompt = `You are an expert educational content creator. Generate content for a "${type}" activity based on the user's prompt.
  
  Your response MUST be a single valid JSON object. In addition to the type-specific fields, you MUST include the following two top-level keys in the root of the JSON object:
  - "activityTitle": "An engaging, professional title based on the topic (max 6-8 words)"
  - "activityDescription": "A concise description (1-2 sentences) of what the student will learn or do"

  Return ONLY valid JSON according to the following structures:

  If type="quiz":
  {
    "activityTitle": "string",
    "activityDescription": "string",
    "questions": [
      { "question": "string", "options": ["opt1", "opt2", "opt3", "opt4"], "correctAnswer": 0, "explanation": "string" }
    ] // 5-10 questions
  }

  If type="reading":
  {
    "activityTitle": "string",
    "activityDescription": "string",
    "passage": "string",
    "questions": [
      { "question": "string", "options": ["opt1", "opt2", "opt3", "opt4"], "correctAnswer": 0 }
    ]
  }

  If type="task":
  {
    "activityTitle": "string",
    "activityDescription": "string",
    "description": "string",
    "subtasks": [ { "id": "string", "text": "string", "completed": false } ],
    "successCriteria": ["string"]
  }

  If type="discussion":
  {
    "activityTitle": "string",
    "activityDescription": "string",
    "prompt": "string",
    "guidingQuestions": ["string"]
  }

  If type="workspace":
  {
    "activityTitle": "string",
    "activityDescription": "string",
    "document": { "enabled": true, "prompt": "string", "minWords": 500 },
    "database": { "enabled": true, "fields": [ { "name": "string", "type": "Text|Number|Date|Select" } ] },
    "graph": { "enabled": true, "prompt": "string", "minNodes": 5, "minConnections": 3 },
    "canvas": { "enabled": true, "prompt": "string", "requiredElements": ["Text Box", "Image"] }
  }

  Ensure high quality, educational content. Return ONLY the JSON object.`;

  const result = await callGroq(systemPrompt, userPrompt, statusCallback);
  
  try {
    return JSON.parse(result);
  } catch (err) {
    console.error('[GroqService] Failed to parse activity content:', result);
    throw new Error('Failed to parse AI response. Please try again.');
  }
}
