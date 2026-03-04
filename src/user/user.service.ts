import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveBodyMetricsDto } from './dto/swagger/body-metrics.dto';

@Injectable()
export class UserService {
	constructor(private readonly prisma: PrismaService) { }

	async findByUsername(username: string) {
		return this.prisma.user.findUnique({
			where: { username },
			select: {
				id: true,
				email: true,
				username: true,
				name: true,
				avatarUrl: true,
				bio: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	}

	async getProfile(userId: string) {
		return this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				username: true,
				name: true,
				email: true,
				avatarUrl: true,
				bio: true,
				role: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	}

	async getBodyMetrics(userId: string) {
		return this.prisma.userProfile.findUnique({
			where: { userId },
			select: {
				age: true,
				gender: true,
				heightCm: true,
				heightFt: true,
				weightKg: true,
				weightLbs: true,
				bodyType: true,
				goal: true,
				updatedAt: true,
			},
		});
	}

	async saveBodyMetrics(userId: string, dto: SaveBodyMetricsDto) {
		const existingProfile = await this.prisma.userProfile.findUnique({
			where: { userId },
		});

		const age = dto.age ?? existingProfile?.age;
		const gender = dto.gender ?? existingProfile?.gender;
		const heightCm = dto.heightCm ?? existingProfile?.heightCm;
		const weightKg = dto.weightKg ?? existingProfile?.weightKg;

		let bmi: number | undefined;
		let maintenanceCalories: number | undefined;

		if (heightCm && weightKg) {
			bmi = weightKg / Math.pow(heightCm / 100, 2);
		}

		if (age && gender && heightCm && weightKg) {
			// Mifflin-St Jeor Equation
			const bmr =
				10 * weightKg +
				6.25 * heightCm -
				5 * age +
				(gender.toLowerCase() === 'male' ? 5 : -161);

			// Activity Factor (Defaulting to Sedentary = 1.2 for now)
			maintenanceCalories = Math.round(bmr * 1.2);
		}

		return this.prisma.userProfile.upsert({
			where: { userId },
			create: {
				userId,
				age: dto.age,
				gender: dto.gender,
				heightCm: dto.heightCm,
				heightFt: dto.heightFt,
				weightKg: dto.weightKg,
				weightLbs: dto.weightLbs,
				bodyType: dto.bodyType,
				goal: dto.goal,
				bmi,
				maintenanceCalories,
			},
			update: {
				...(dto.age !== undefined && { age: dto.age }),
				...(dto.gender !== undefined && { gender: dto.gender }),
				...(dto.heightCm !== undefined && { heightCm: dto.heightCm }),
				...(dto.heightFt !== undefined && { heightFt: dto.heightFt }),
				...(dto.weightKg !== undefined && { weightKg: dto.weightKg }),
				...(dto.weightLbs !== undefined && { weightLbs: dto.weightLbs }),
				...(dto.bodyType !== undefined && { bodyType: dto.bodyType }),
				...(dto.goal !== undefined && { goal: dto.goal }),
				...(bmi !== undefined && { bmi }),
				...(maintenanceCalories !== undefined && { maintenanceCalories }),
				updatedAt: new Date(),
			},
			select: {
				age: true,
				gender: true,
				heightCm: true,
				heightFt: true,
				weightKg: true,
				weightLbs: true,
				bodyType: true,
				goal: true,
				bmi: true,
				maintenanceCalories: true,
				updatedAt: true,
			},
		});
	}
}

