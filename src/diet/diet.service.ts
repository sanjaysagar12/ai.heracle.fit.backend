import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveDietPreferencesDto } from './dto/diet-preferences.dto';
import { LogMealRequestDto } from './dto/log-meal-request.dto';
import { LogMealResponseDto } from './dto/log-meal-response.dto';
import { AnalyseFoodResponseDto } from './dto/analyse-food-response.dto';
import OpenAI from 'openai';
import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} from '@google/generative-ai';
import { InferenceClient } from '@huggingface/inference';

type FoodItem = {
    name: string;
    purpose: string; // e.g., "Protein", "Carbs", "Fat", "Fiber"
    calories: number;
    carbs: number;
    protein: number;
    fat: number;
    fiber: number;
};

const SYSTEM_PROMPT = `You are a professional nutritionist AI.
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

const SUGGESTION_PROMPT = `You are a professional nutritionist AI.
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

@Injectable()
export class DietService {
    private readonly openai: OpenAI;
    private readonly gemini: GoogleGenerativeAI;
    private readonly hf: InferenceClient;

    constructor(private readonly prisma: PrismaService) {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API });
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API ?? '');
        this.hf = new InferenceClient(process.env.HUGGINGFACE_API ?? '', {
            endpointUrl: process.env.HUGGINGFACE_BASE_URL,
        });
    }

    async getTodayDiet(userId: string) {
        const today = new Date().toISOString().split('T')[0];
        return this.prisma.dietSuggestion.findFirst({
            where: {
                userId,
                date: today,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async getMealsByDate(userId: string, date: string) {
        return this.prisma.meal.findMany({
            where: {
                userId,
                date,
            },
            orderBy: {
                time: 'asc',
            },
        });
    }

    // ── Diet Preferences ───────────────────────────────────────────────────────

    async getDietPreferences(userId: string) {
        return this.prisma.userProfile.findUnique({
            where: { userId },
            select: {
                dietaryPreference: true,
                dailyWaterLitres: true,
                mealsPerDay: true,
                updatedAt: true,
            },
        });
    }

    async saveDietPreferences(userId: string, dto: SaveDietPreferencesDto) {
        return this.prisma.userProfile.upsert({
            where: { userId },
            create: {
                userId,
                dietaryPreference: dto.dietaryPreference,
                dailyWaterLitres: dto.dailyWaterLitres,
                mealsPerDay: dto.mealsPerDay,
            },
            update: {
                ...(dto.dietaryPreference !== undefined && { dietaryPreference: dto.dietaryPreference }),
                ...(dto.dailyWaterLitres !== undefined && { dailyWaterLitres: dto.dailyWaterLitres }),
                ...(dto.mealsPerDay !== undefined && { mealsPerDay: dto.mealsPerDay }),
                updatedAt: new Date(),
            },
            select: {
                dietaryPreference: true,
                dailyWaterLitres: true,
                mealsPerDay: true,
                updatedAt: true,
            },
        });
    }

    async getDailyNutritionalStatus(userId: string, date: string) {
        const profile = await this.prisma.userProfile.findUnique({
            where: { userId },
            select: {
                targetCalories: true,
                targetProtein: true,
                targetCarbs: true,
                targetFat: true,
                targetFiber: true,
            },
        });

        const meals = await this.prisma.meal.findMany({
            where: { userId, date },
        });

        const consumed = meals.reduce(
            (acc, meal) => {
                const foodItems = (meal.data as any) || [];
                foodItems.forEach((item: any) => {
                    acc.calories += item.calories || 0;
                    acc.protein += item.protein || 0;
                    acc.carbs += item.carbs || 0;
                    acc.fat += item.fat || 0;
                    acc.fiber += item.fiber || 0;
                });
                return acc;
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        );

        return {
            targets: {
                calories: profile?.targetCalories || 0,
                protein: profile?.targetProtein || 0,
                carbs: profile?.targetCarbs || 0,
                fat: profile?.targetFat || 0,
                fiber: profile?.targetFiber || 0,
            },
            consumed: {
                calories: Math.round(consumed.calories),
                protein: Number(consumed.protein.toFixed(1)),
                carbs: Number(consumed.carbs.toFixed(1)),
                fat: Number(consumed.fat.toFixed(1)),
                fiber: Number(consumed.fiber.toFixed(1)),
            },
        };
    }

    // ── Meal Log (no AI — user provides nutrition data) ────────────────────────

    async logMeal(userId: string, dto: LogMealRequestDto): Promise<LogMealResponseDto> {
        const meal = await this.prisma.meal.create({
            data: {
                userId,
                mealType: dto.mealType,
                date: dto.date,
                time: dto.time,
                data: dto.data as any,
            },
        });

        console.log("AI Suggesting...")
        // Trigger dynamic suggestion update
        const suggestions = await this.generateDietSuggestion(userId);
        console.log("AI Suggestion", suggestions)
        return {
            id: meal.id,
            userId: meal.userId,
            mealType: meal.mealType,
            date: meal.date,
            time: meal.time,
            data: meal.data as any,
            latestSuggestion: suggestions ? {
                id: suggestions.id,
                suggestion: suggestions.suggestion,
                suggestedMeal: suggestions.suggestedMeal as any,
                date: suggestions.date,
                createdAt: suggestions.createdAt,
            } : undefined,
            createdAt: meal.createdAt,
        };
    }

    // ── AI Food Analysis (no DB save — returns nutrition only) ─────────────────

    async analyseFood(
        description?: string,
        imageFile?: Express.Multer.File,
    ): Promise<AnalyseFoodResponseDto> {
        if (!imageFile && !description) {
            throw new BadRequestException(
                'At least one of image (file upload) or description must be provided.',
            );
        }

        const provider = (process.env.AI_PROVIDER ?? 'openai').toLowerCase();

        const raw =
            provider === 'gemini'
                ? await this.analyseWithGemini(description, imageFile)
                : provider === 'huggingface'
                    ? await this.analyseWithHuggingFace(description, imageFile)
                    : await this.analyseWithOpenAI(description, imageFile);

        const cleanedRaw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

        let result: AnalyseFoodResponseDto;
        try {
            result = JSON.parse(cleanedRaw);
            if (typeof result !== 'object' || Array.isArray(result)) throw new Error('Not an object');
        } catch {
            throw new BadRequestException(
                `${provider === 'gemini' ? 'Gemini' : 'OpenAI'} returned an unexpected format. Please try again or provide a clearer image/description.`,
            );
        }

        return result;
    }

    // ── Private AI helpers ─────────────────────────────────────────────────────

    private async analyseWithOpenAI(
        description?: string,
        imageFile?: Express.Multer.File,
    ): Promise<string> {
        const model = process.env.OPENAI_MODEL ?? 'gpt-4o';

        type ContentPart =
            | { type: 'text'; text: string }
            | { type: 'image_url'; image_url: { url: string; detail: 'auto' } };

        const userContent: ContentPart[] = [];

        if (imageFile) {
            const mimeType = imageFile.mimetype || 'image/jpeg';
            const b64 = imageFile.buffer.toString('base64');
            userContent.push({
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${b64}`, detail: 'auto' },
            });
        }
        if (description) {
            userContent.push({ type: 'text', text: description });
        }

        try {
            const completion = await this.openai.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userContent },
                ],
                max_tokens: 1024,
            });
            return completion.choices[0]?.message?.content ?? '[]';
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (/503|Service Unavailable|overload|high demand/i.test(msg) ||
                /429|Too Many Requests|rate limit/i.test(msg)) {
                throw new ServiceUnavailableException(
                    `The AI model (${model}) is temporarily unavailable or rate-limited. Please try again in a moment.`,
                );
            }
            throw new InternalServerErrorException(
                `OpenAI request failed (model: ${model}): ${msg}`,
            );
        }
    }

    private async analyseWithGemini(
        description?: string,
        imageFile?: Express.Multer.File,
    ): Promise<string> {
        const modelName = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';

        const geminiKey = process.env.GEMINI_API ?? '';
        if (!geminiKey || geminiKey === 'your-gemini-api-key-here') {
            throw new InternalServerErrorException(
                'GEMINI_API key is not configured. Add your key to .env and restart the server.',
            );
        }

        const model = this.gemini.getGenerativeModel({
            model: modelName,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts: any[] = [{ text: SYSTEM_PROMPT }];

        if (imageFile) {
            parts.push({
                inlineData: {
                    mimeType: imageFile.mimetype || 'image/jpeg',
                    data: imageFile.buffer.toString('base64'),
                },
            });
        }
        if (description) {
            parts.push({ text: description });
        }

        try {
            const result = await model.generateContent(parts);
            return result.response.text() ?? '[]';
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (/503|Service Unavailable|overload|high demand/i.test(msg) ||
                /429|Too Many Requests|rate limit/i.test(msg)) {
                throw new ServiceUnavailableException(
                    `The AI model (${modelName}) is temporarily unavailable or rate-limited. Please try again in a moment.`,
                );
            }
            throw new InternalServerErrorException(
                `Gemini request failed (model: ${modelName}): ${msg}. ` +
                'Check your GEMINI_API key and network connectivity.',
            );
        }
    }

    private async generateDietSuggestion(userId: string) {
        try {
            const profile = await this.prisma.userProfile.findUnique({
                where: { userId },
            });

            if (!profile) {
                console.warn(`User profile not found for userId: ${userId}. Skipping suggestion.`);
                return null;
            }

            const today = new Date().toISOString().split('T')[0];
            const status = await this.getDailyNutritionalStatus(userId, today);

            const remaining = {
                calories: Math.max(0, status.targets.calories - status.consumed.calories),
                protein: Math.max(0, status.targets.protein - status.consumed.protein),
                carbs: Math.max(0, status.targets.carbs - status.consumed.carbs),
                fat: Math.max(0, status.targets.fat - status.consumed.fat),
                fiber: Math.max(0, status.targets.fiber - status.consumed.fiber),
            };

            const userContext = `
                Profile: age ${profile.age}, gender ${profile.gender}, height ${profile.heightCm}cm, weight ${profile.weightKg}kg, goal ${profile.goal}.
                Meals per day: ${profile.mealsPerDay || 3}.

                Daily Nutritional Status:
                - Targets: { calories: ${status.targets.calories}kcal, protein: ${status.targets.protein}g, carbs: ${status.targets.carbs}g, fat: ${status.targets.fat}g, fiber: ${status.targets.fiber}g }
                - Consumed Today: { calories: ${status.consumed.calories}kcal, protein: ${status.consumed.protein}g, carbs: ${status.consumed.carbs}g, fat: ${status.consumed.fat}g, fiber: ${status.consumed.fiber}g }
                - Gap (Lacking): { calories: ${remaining.calories}kcal, protein: ${remaining.protein}g, carbs: ${remaining.carbs}g, fat: ${remaining.fat}g, fiber: ${remaining.fiber}g }
            `;

            const provider = (process.env.AI_PROVIDER ?? 'openai').toLowerCase();

            let aiResponseRaw: string;
            if (provider === 'gemini') {
                aiResponseRaw = await this.getAiCompletionGemini(SUGGESTION_PROMPT, userContext);
            } else if (provider === 'huggingface') {
                aiResponseRaw = await this.getAiCompletionHuggingFace(SUGGESTION_PROMPT, userContext);
            } else {
                aiResponseRaw = await this.getAiCompletionOpenAI(SUGGESTION_PROMPT, userContext);
            }

            const content = aiResponseRaw;
            console.log('AI Diet Suggestion raw:', content);

            let aiResult;
            try {
                const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
                aiResult = JSON.parse(cleaned || '{}');
            } catch (e) {
                console.error('Failed to parse AI diet suggestion:', e);
                return null;
            }

            const mealTotal = (aiResult.items || []).reduce(
                (acc, item: any) => {
                    acc.calories += item.calories || 0;
                    acc.protein += item.protein || 0;
                    acc.carbs += item.carbs || 0;
                    acc.fat += item.fat || 0;
                    acc.fiber += item.fiber || 0;
                    return acc;
                },
                { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
            );

            // Meal targets (daily targets / meals per day)
            const mealsPerDay = profile.mealsPerDay || 3;
            const mealTargetCals = (profile.targetCalories || 2000) / mealsPerDay;
            const mealTargetProtein = (profile.targetProtein || 150) / mealsPerDay;
            const mealTargetCarbs = (profile.targetCarbs || 250) / mealsPerDay;
            const mealTargetFat = (profile.targetFat || 65) / mealsPerDay;
            const mealTargetFiber = (profile.targetFiber || 30) / mealsPerDay;

            const finalExplanation = aiResult.explanation;

            return this.prisma.dietSuggestion.upsert({
                where: { userId_date: { userId, date: today } },
                create: {
                    userId,
                    date: today,
                    suggestion: finalExplanation,
                    suggestedMeal: aiResult.items,
                },
                update: {
                    suggestion: finalExplanation,
                    suggestedMeal: aiResult.items,
                    updatedAt: new Date(),
                },
            });
        } catch (error) {
            console.error('Error generating diet suggestion:', error);
            return null;
        }
    }

    private async analyseWithHuggingFace(
        description?: string,
        imageFile?: Express.Multer.File,
    ): Promise<string> {
        const hasValidImage = !!(imageFile && imageFile.buffer && imageFile.buffer.length > 0);

        let modelName = process.env.HUGGINGFACE_MODEL ?? 'meta-llama/Llama-3.2-11B-Vision-Instruct';
        // If no image is provided, use the more capable text model for better analysis
        if (!hasValidImage) {
            modelName = process.env.HUGGINGFACE_TEXT_MODEL ?? modelName;
        }

        const hfProvider = process.env.HUGGINGFACE_PROVIDER ?? 'novita';
        const fullModelName = `${modelName}:${hfProvider}`;

        type ContentPart =
            | { type: 'text'; text: string }
            | { type: 'image_url'; image_url: { url: string } };

        const userContent: ContentPart[] = [];

        if (hasValidImage) {
            const mimeType = imageFile!.mimetype || 'image/jpeg';
            const b64 = imageFile!.buffer.toString('base64');
            userContent.push({
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${b64}` },
            });
        }
        if (description) {
            userContent.push({ type: 'text', text: description });
        }

        try {
            const result = await this.hf.chatCompletion({
                model: fullModelName,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userContent as any },
                ],
                max_tokens: 1024,
            });
            return result.choices[0]?.message?.content ?? '{}';
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new InternalServerErrorException(`HuggingFace request failed: ${msg}`);
        }
    }

    private async getAiCompletionOpenAI(system: string, user: string): Promise<string> {
        const model = process.env.OPENAI_MODEL ?? 'gpt-4o';
        const completion = await this.openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
            max_tokens: 1024,
        });
        return completion.choices[0]?.message?.content ?? '';
    }

    private async getAiCompletionGemini(system: string, user: string): Promise<string> {
        const modelName = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
        const model = this.gemini.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([{ text: system }, { text: user }]);
        return result.response.text() ?? '';
    }

    private async getAiCompletionHuggingFace(system: string, user: string): Promise<string> {
        const modelName = process.env.HUGGINGFACE_TEXT_MODEL ?? process.env.HUGGINGFACE_MODEL ?? 'meta-llama/Meta-Llama-3.1-8B-Instruct';
        const hfProvider = process.env.HUGGINGFACE_PROVIDER ?? 'novita';
        const fullModelName = `${modelName}:${hfProvider}`;
        try {
            const result = await this.hf.chatCompletion({
                model: fullModelName,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
                max_tokens: 1024,
            });
            return result.choices[0]?.message?.content ?? '';
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new InternalServerErrorException(`HuggingFace request failed: ${msg}`);
        }
    }
}
