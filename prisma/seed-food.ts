import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding food items...');

    const foodItems = [
        { name: 'Apple Medium', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4.4 },
        { name: 'Banana Medium', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1 },
        { name: 'Chicken Breast (100g)', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
        { name: 'White Rice (1 cup cooked)', calories: 205, protein: 4.3, carbs: 45, fat: 0.4, fiber: 0.6 },
        { name: 'Brown Rice (1 cup cooked)', calories: 216, protein: 5, carbs: 45, fat: 1.8, fiber: 3.5 },
        { name: 'Egg (Large)', calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fiber: 0 },
        { name: 'Oatmeal (1 cup cooked)', calories: 158, protein: 6, carbs: 27, fat: 3.2, fiber: 4 },
        { name: 'Almonds (1 oz)', calories: 164, protein: 6, carbs: 6, fat: 14, fiber: 3.5 },
        { name: 'Broccoli (1 cup)', calories: 55, protein: 3.7, carbs: 11.2, fat: 0.6, fiber: 5.1 },
        { name: 'Salmon (100g)', calories: 206, protein: 22, carbs: 0, fat: 13, fiber: 0 },
        { name: 'Sweet Potato (Medium)', calories: 103, protein: 2, carbs: 24, fat: 0.2, fiber: 3.8 },
        { name: 'Greek Yogurt (100g)', calories: 59, protein: 10, carbs: 3.6, fat: 0.4, fiber: 0 },
    ];

    for (const food of foodItems) {
        await prisma.foodItem.upsert({
            where: { name: food.name },
            update: food,
            create: food,
        });
    }

    console.log('Finished seeding food items.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
