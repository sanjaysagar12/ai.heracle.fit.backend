import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSleepDataDto } from './dto/sleep.dto';
import { AiService } from '../ai/ai.service';
import { runSleepInsight } from './sleep.ai';

@Injectable()
export class SleepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) { }

  async addSleepData(userId: string, dto: CreateSleepDataDto) {
    const sleepCycle = await this.prisma.sleepCycle.findFirst({
      where: { userId },
    });

    let currentData: any[] = [];
    if (sleepCycle && sleepCycle.sleepData) {
      currentData = sleepCycle.sleepData as any[];
    }

    // Append new data
    currentData.push(dto);

    // Keep only last 7 items (1 week)
    if (currentData.length > 7) {
      currentData = currentData.slice(-7);
    }

    if (sleepCycle) {
      return this.prisma.sleepCycle.update({
        where: { id: sleepCycle.id },
        data: {
          sleepData: currentData,
        },
      });
    } else {
      return this.prisma.sleepCycle.create({
        data: {
          userId,
          sleepData: currentData,
        },
      });
    }
  }

  async getSleepData(userId: string) {
    const sleepCycle = await this.prisma.sleepCycle.findFirst({
      where: { userId },
    });

    if (!sleepCycle) {
      return { sleepData: [] };
    }

    let currentData = sleepCycle.sleepData as any[];

    // Ensure only last 1 week is stored/returned as per requirement
    if (currentData.length > 7) {
      currentData = currentData.slice(-7);
      // Update DB if we found more than 7 items during GET (optional but good for consistency)
      await this.prisma.sleepCycle.update({
        where: { id: sleepCycle.id },
        data: { sleepData: currentData },
      });
    }

    return { sleepData: currentData };
  }

  async getAiInsight(userId: string) {
    const today = new Date().toISOString().split('T')[0];

    const sleepCycle = await this.prisma.sleepCycle.findFirst({
      where: { userId },
    });

    // If we already have an insight for today, return it
    if (sleepCycle?.SleepCycle && sleepCycle?.insightDate === today) {
      return { insight: sleepCycle.SleepCycle };
    }

    const sleepData = await this.getSleepData(userId);
    const context = JSON.stringify(sleepData.sleepData);

    try {
      const result = await runSleepInsight(this.aiService, context);
      const insightText = result.insight;

      if (sleepCycle) {
        await this.prisma.sleepCycle.update({
          where: { id: sleepCycle.id },
          data: {
            SleepCycle: insightText,
            insightDate: today,
          },
        });
      } else {
        await this.prisma.sleepCycle.create({
          data: {
            userId,
            sleepData: [],
            SleepCycle: insightText,
            insightDate: today,
          },
        });
      }

      return { insight: insightText };
    } catch (error) {
      console.error('[SleepService] AI Insight failed:', error);
      throw new InternalServerErrorException('Failed to generate sleep insight');
    }
  }
}
