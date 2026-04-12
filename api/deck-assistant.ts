import type { DeckAssistantRequest, DeckAssistantResponse } from '../src/types/assistant';

export const config = {
  runtime: 'edge',
};

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });

const buildSystemPrompt = () => `
You are a Yu-Gi-Oh deck assistant for a browser duel app.

Rules:
- Only discuss the provided card pool.
- Be grounded in the support metadata. Unsupported or partial cards should be called out clearly.
- Do not invent cards, combos, or mechanics outside the provided app context.
- Return compact structured JSON only.

Schema:
{
  "summary": string,
  "strengths": string[],
  "weaknesses": string[],
  "suggestions": [
    {
      "action": "add" | "cut" | "keep",
      "cardId": string,
      "reason": string
    }
  ]
}
`.trim();

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response('Deck assistant is not configured. Add OPENAI_API_KEY on the server.', { status: 503 });
  }

  const payload = await request.json() as DeckAssistantRequest;
  if (!payload.mainDeck?.length) {
    return new Response('Deck payload is missing.', { status: 400 });
  }

  const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      input: [
        {
          role: 'system',
          content: [{ type: 'text', text: buildSystemPrompt() }],
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'deck_assistant_response',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['summary', 'strengths', 'weaknesses', 'suggestions'],
            properties: {
              summary: { type: 'string' },
              strengths: {
                type: 'array',
                items: { type: 'string' },
              },
              weaknesses: {
                type: 'array',
                items: { type: 'string' },
              },
              suggestions: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['action', 'cardId', 'reason'],
                  properties: {
                    action: {
                      type: 'string',
                      enum: ['add', 'cut', 'keep'],
                    },
                    cardId: { type: 'string' },
                    reason: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!openAiResponse.ok) {
    const errorText = await openAiResponse.text();
    return new Response(errorText || 'OpenAI request failed.', { status: 502 });
  }

  const responseJson = await openAiResponse.json() as {
    output_text?: string;
  };

  if (!responseJson.output_text) {
    return new Response('Assistant response was empty.', { status: 502 });
  }

  return json(JSON.parse(responseJson.output_text) as DeckAssistantResponse);
}
