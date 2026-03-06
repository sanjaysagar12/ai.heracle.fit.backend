"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var foodItems, _i, foodItems_1, food;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Seeding food items...');
                    foodItems = [
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
                    _i = 0, foodItems_1 = foodItems;
                    _a.label = 1;
                case 1:
                    if (!(_i < foodItems_1.length)) return [3 /*break*/, 4];
                    food = foodItems_1[_i];
                    return [4 /*yield*/, prisma.foodItem.upsert({
                            where: { name: food.name },
                            update: food,
                            create: food,
                        })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log('Finished seeding food items.');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
