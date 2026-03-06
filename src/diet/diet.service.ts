import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveDietPreferencesDto } from './dto/diet-preferences.dto';
import { LogMealRequestDto } from './dto/log-meal-request.dto';
import { LogMealResponseDto } from './dto/log-meal-response.dto';
import { AnalyseFoodResponseDto } from './dto/analyse-food-response.dto';
import { AiService } from '../ai/ai.service';
import {
    runFoodAnalysis,
    runDietSuggestion,
    cleanAiResponse
} from './diet.ai';

@Injectable()
export class DietService {

    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AiService,
    ) { }

    async getTodayDiet(userId: string) {
        const today = new Date().toISOString().split('T')[0];

        // Return cached suggestion if one already exists for today
        const existing = await this.prisma.dietSuggestion.findFirst({
            where: { userId, date: today },
            orderBy: { createdAt: 'desc' },
        });
        if (existing) return existing;

        // No suggestion yet — generate one from AI and persist it
        console.log(`[DietService] No suggestion for ${today}, triggering AI generation for user ${userId}`);
        const generated = await this.generateDietSuggestion(userId);
        return generated ?? null;
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

    // ── Food Search ────────────────────────────────────────────────────────────

    async searchFood(query: string) {
        if (!query || query.trim().length === 0) return [];

        return this.prisma.foodItem.findMany({
            where: {
                name: {
                    contains: query.trim(),
                    mode: 'insensitive', // PostgreSQL specific, but supported by Prisma if configured
                },
            },
            take: 20,
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

        try {
            return await runFoodAnalysis(
                this.aiService,
                description,
                imageFile?.buffer,
                imageFile?.mimetype
            );
        } catch (error: any) {
            throw new BadRequestException(error.message);
        }
    }

    async generateDietSuggestion(userId: string) {
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

            const aiResult = await runDietSuggestion(this.aiService, userContext);
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
}
