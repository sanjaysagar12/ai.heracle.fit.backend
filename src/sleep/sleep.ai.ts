import { cleanAiResponse } from '../diet/diet.ai';

export const SLEEP_INSIGHT_PROMPT = `You are a professional sleep coach AI.
Based on the provided sleep data (last 7 days), analyze the user's sleep cycles and circadian rhythm.
Provide a concise, professional insight. 

CRITICAL RULES:
1. Focus on consistency, sleep cycles, and circadian rhythm.
2. In the insight, use curly braces {} to highlight only 1 or 2 most important words (e.g., {consistency} or {circadian rhythm}). 
3. Do NOT highlight more than 2 words.
4. Respond with ONLY a valid JSON object.
5. DO NOT use markdown formatting, DO NOT wrap the response in \`\`\`json code blocks. Just return the raw JSON braces.

The object must follow this exact shape:
{
  "insight": "Your professional insight message here."
}
If no data is provided, return a general insight about maintaining a healthy sleep cycle.`;

export async function runSleepInsight(
  aiService: any,
  sleepContext: string
): Promise<any> {
  const provider = (process.env.SLEEP_INSIGHT_PROVIDER ?? 'openai').toLowerCase();

  let modelName: string;
  if (provider === 'gemini') {
    modelName = process.env.SLEEP_INSIGHT_MODEL ?? 'gemini-1.5-flash';
  } else if (provider === 'huggingface') {
    modelName = process.env.SLEEP_INSIGHT_MODEL ?? 'Qwen/Qwen2.5-VL-72B-Instruct';
  } else {
    modelName = process.env.SLEEP_INSIGHT_MODEL ?? 'gpt-4o';
  }

  let aiResponseRaw: string;
  if (provider === 'gemini') {
    aiResponseRaw = await aiService.getGeminiCompletion([{ text: SLEEP_INSIGHT_PROMPT }, { text: sleepContext }], modelName);
  } else if (provider === 'huggingface') {
    aiResponseRaw = await aiService.getHuggingFaceCompletion({
      model: modelName,
      messages: [
        { role: 'system', content: SLEEP_INSIGHT_PROMPT },
        { role: 'user', content: sleepContext },
      ],
      max_tokens: 1024,
    });
  } else {
    aiResponseRaw = await aiService.getOpenAICompletion({
      model: modelName,
      messages: [
        { role: 'system', content: SLEEP_INSIGHT_PROMPT },
        { role: 'user', content: sleepContext },
      ],
      max_tokens: 1024,
    });
  }

  const cleaned = cleanAiResponse(aiResponseRaw);
  try {
    return JSON.parse(cleaned || '{}');
  } catch (e) {
    console.error('Failed to parse AI sleep insight:', e);
    throw new Error('Failed to parse AI sleep insight');
  }
}
