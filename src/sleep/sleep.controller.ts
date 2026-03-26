import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { SleepService } from './sleep.service';
import { CreateSleepDataDto, SleepCycleResponseDto, SleepInsightResponseDto } from './dto/sleep.dto';

@ApiTags('Sleep')
@ApiBearerAuth('JWT')
@Controller('sleep')
export class SleepController {
  constructor(private readonly sleepService: SleepService) {}

  @Post()
  @ApiOperation({ summary: 'Add sleep data' })
  @ApiOkResponse({ type: SleepCycleResponseDto })
  async addSleepData(@Req() req: any, @Body() body: CreateSleepDataDto) {
    return this.sleepService.addSleepData(req.user.id, body);
  }

  @Get()
  @ApiOperation({ summary: 'Get last 1 week of sleep data' })
  @ApiOkResponse({ type: SleepCycleResponseDto })
  async getSleepData(@Req() req: any) {
    return this.sleepService.getSleepData(req.user.id);
  }

  @Get('insight')
  @ApiOperation({ summary: 'Get AI sleep coach insight' })
  @ApiOkResponse({ type: SleepInsightResponseDto })
  async getAiInsight(@Req() req: any): Promise<SleepInsightResponseDto> {
    return this.sleepService.getAiInsight(req.user.id);
  }
}
