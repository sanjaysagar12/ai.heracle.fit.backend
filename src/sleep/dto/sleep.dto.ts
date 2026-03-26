import { ApiProperty } from '@nestjs/swagger';

export class CreateSleepDataDto {
  @ApiProperty({ example: '2026-03-26', description: 'Date in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({ example: 8, description: 'Hours of sleep' })
  sleephrs: number;

  @ApiProperty({ example: '22:00', description: 'Bedtime in HH:MM format' })
  bedtime: string;

  @ApiProperty({ example: '06:00', description: 'Wakeup time in HH:MM format' })
  wakeup_time: string;
}

export class SleepCycleResponseDto {
  @ApiProperty({ type: [CreateSleepDataDto] })
  sleepData: CreateSleepDataDto[];
}

export class SleepInsightResponseDto {
  @ApiProperty({ example: 'Your circadian rhythm is well-aligned. Maintaining {consistency} is key.' })
  insight: string;
}
