import { ApiProperty } from '@nestjs/swagger';

export class SearchFoodResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ example: 'Apple Medium' })
    name: string;

    @ApiProperty({ example: 95 })
    calories: number;

    @ApiProperty({ example: 0.5 })
    protein: number;

    @ApiProperty({ example: 25 })
    carbs: number;

    @ApiProperty({ example: 0.3 })
    fat: number;

    @ApiProperty({ example: 4.4 })
    fiber: number;
}
