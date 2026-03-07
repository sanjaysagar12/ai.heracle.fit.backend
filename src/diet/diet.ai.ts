export const SYSTEM_PROMPT = `You are a professional nutritionist AI.
Analyse the provided food (image and/or description).
Provide a concise name and description for the entire meal. The 'name' field should explicitly mention the main food items identified (e.g., "Grilled Chicken, Rice, and Broccoli").
Calculate the TOTAL nutritional values summed across all food items identified.
Respond with ONLY a valid JSON object.
CRITICAL: DO NOT use markdown formatting, DO NOT wrap the response in \`\`\`json code blocks. Just return the raw JSON braces.
The object must follow this exact shape:
{ "name": string, "description": string, "calories": number, "carbs": number, "protein": number, "fat": number, "fiber": number }
All numeric values (carbs, protein, fat, fiber) must be total grams (g) for the entire meal.
Calories must be the total kcal for the entire meal.
If you cannot determine a value, use 0.`;

export const SUGGESTION_PROMPT = `You are a professional nutritionist AI.
Based on the provided nutritional status (Targets, Consumed, and remaining Gap), suggest a single balanced meal.
Your goal is to fill the "Gap" (nutritional lack) while acknowledging when the user has done "good" by meeting or staying within targets.
The "Gap" tells you exactly what is missing for the day.

FORMATTING RULE: In the 'explanation' field, use curly braces {} sparingly (only 1 or 2 times total) to highlight the most critical nutritional value or benefit (e.g., {500kcal} or {high protein}).

Respond with ONLY a valid JSON object.
CRITICAL: DO NOT use curly braces {} inside the "items" JSON values. The numeric values in "items" must be raw numbers.
CRITICAL: DO NOT use markdown formatting, DO NOT wrap the response in \`\`\`json code blocks. Just return the raw JSON braces.

The object must follow this exact shape:
{
  "explanation": "A very short (max 1 sentence) explanation. Use curly braces {} to highlight only 1-2 key items (e.g., {500kcal}). Keep it extremely concise.",
  "items": [
    { "name": string, "purpose": string, "calories": number, "carbs": number, "protein": number, "fat": number, "fiber": number }
  ]
}
The "purpose" field should be one of: "Protein", "Carbs", "Fat", "Fiber" based on the main nutritional contribution of that specific item.
All numeric values must be in grams (g) except calories which are in kcal.
If you cannot determine a value, use 0.`;

export function cleanAiResponse(raw: string): string {
    return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
}

export async function runFoodAnalysis(
    aiService: any,
    description?: string,
    imageBuffer?: Buffer,
    mimeType?: string
): Promise<any> {
    const provider = (process.env.FOOD_ANALYSE_PROVIDER ?? 'openai').toLowerCase();

    let modelName: string;
    if (provider === 'gemini') {
        modelName = process.env.FOOD_ANALYSE_MODEL ?? 'gemini-1.5-flash';
    } else if (provider === 'huggingface') {
        modelName = process.env.FOOD_ANALYSE_MODEL ?? 'Qwen/Qwen2.5-VL-72B-Instruct';
    } else {
        modelName = process.env.FOOD_ANALYSE_MODEL ?? 'gpt-4o';
    }

    let raw: string;
    if (provider === 'gemini') {
        const parts = formatVisionPartsGemini(SYSTEM_PROMPT, description, imageBuffer, mimeType);
        raw = await aiService.getGeminiCompletion(parts, modelName);
    } else if (provider === 'huggingface') {
        const payload = formatVisionPayloadHuggingFace(modelName, SYSTEM_PROMPT, description, imageBuffer, mimeType);
        raw = await aiService.getHuggingFaceVision(payload);
    } else {
        const payload = formatVisionPayloadOpenAI(modelName, SYSTEM_PROMPT, description, imageBuffer, mimeType);
        raw = await aiService.getOpenAICompletion(payload);
    }

    const cleanedRaw = cleanAiResponse(raw);
    try {
        const result = JSON.parse(cleanedRaw);
        if (typeof result !== 'object' || Array.isArray(result)) throw new Error('Not an object');
        return result;
    } catch {
        throw new Error(`${provider} returned an unexpected format.`);
    }
}

export async function runDietSuggestion(
    aiService: any,
    userContext: string
): Promise<any> {
    const provider = (process.env.DIET_SUGGESTION_PROVIDER ?? 'openai').toLowerCase();

    let modelName: string;
    if (provider === 'gemini') {
        modelName = process.env.DIET_SUGGESTION_MODEL ?? 'gemini-1.5-flash';
    } else if (provider === 'huggingface') {
        modelName = process.env.DIET_SUGGESTION_MODEL ?? 'Qwen/Qwen2.5-VL-72B-Instruct';
    } else {
        modelName = process.env.DIET_SUGGESTION_MODEL ?? 'gpt-4o';
    }

    let aiResponseRaw: string;
    if (provider === 'gemini') {
        aiResponseRaw = await aiService.getGeminiCompletion([{ text: SUGGESTION_PROMPT }, { text: userContext }], modelName);
    } else if (provider === 'huggingface') {
        aiResponseRaw = await aiService.getHuggingFaceCompletion({
            model: modelName,
            messages: [
                { role: 'system', content: SUGGESTION_PROMPT },
                { role: 'user', content: userContext },
            ],
            max_tokens: 1024,
        });
    } else {
        aiResponseRaw = await aiService.getOpenAICompletion({
            model: modelName,
            messages: [
                { role: 'system', content: SUGGESTION_PROMPT },
                { role: 'user', content: userContext },
            ],
            max_tokens: 1024,
        });
    }

    const cleaned = cleanAiResponse(aiResponseRaw);
    try {
        return JSON.parse(cleaned || '{}');
    } catch (e) {
        console.error('Failed to parse AI diet suggestion:', e);
        throw new Error('Failed to parse AI diet suggestion');
    }
}

export function formatVisionPayloadOpenAI(model: string, systemPrompt: string, description?: string, imageBuffer?: Buffer, mimeType?: string) {
    const userContent: any[] = [];
    if (imageBuffer) {
        userContent.push({
            type: 'image_url',
            image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBuffer.toString('base64')}`, detail: 'auto' },
        });
    }
    if (description) {
        userContent.push({ type: 'text', text: description });
    }
    return {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
        ],
        max_tokens: 1024,
    };
}

export function formatVisionPartsGemini(systemPrompt: string, description?: string, imageBuffer?: Buffer, mimeType?: string) {
    const parts: any[] = [{ text: systemPrompt }];
    if (imageBuffer) {
        parts.push({
            inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageBuffer.toString('base64'),
            },
        });
    }
    if (description) {
        parts.push({ text: description });
    }
    return parts;
}

export function formatVisionPayloadHuggingFace(model: string, systemPrompt: string, description?: string, imageBuffer?: Buffer, mimeType?: string) {
    const userContent: any[] = [];
    if (imageBuffer) {
        userContent.push({
            type: 'image_url',
            image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBuffer.toString('base64')}` }
        });
    }
    if (description) {
        userContent.push({ type: 'text', text: description });
    }
    return {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
        ],
        max_tokens: 1024,
    };
}
