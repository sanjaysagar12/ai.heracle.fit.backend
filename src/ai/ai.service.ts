import { Injectable, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { InferenceClient } from '@huggingface/inference';

@Injectable()
export class AiService {
    private readonly openai: OpenAI;
    private readonly gemini: GoogleGenerativeAI;
    private readonly hf: InferenceClient;

    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API });
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API ?? '');
        this.hf = new InferenceClient(process.env.HUGGINGFACE_API ?? '', {
            endpointUrl: process.env.HUGGINGFACE_BASE_URL,
        });
    }

    async getOpenAICompletion(payload: any): Promise<string> {
        try {
            const completion = await this.openai.chat.completions.create(payload);
            return completion.choices[0]?.message?.content ?? '';
        } catch (err: any) {
            this.handleError('OpenAI', err, payload.model);
        }
    }

    async getGeminiCompletion(parts: any[], modelName: string = 'gemini-1.5-flash'): Promise<string> {
        try {
            const model = this.gemini.getGenerativeModel({
                model: modelName,
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                ],
            });
            const result = await model.generateContent(parts);
            return result.response.text() ?? '';
        } catch (err: any) {
            this.handleError('Gemini', err, modelName);
        }
    }

    async getHuggingFaceCompletion(payload: any): Promise<string> {
        try {
            const result = await this.hf.chatCompletion(payload);
            return result.choices[0]?.message?.content ?? '';
        } catch (err: any) {
            this.handleError('HuggingFace', err, payload.model);
        }
    }

    async getHuggingFaceVision(payload: any): Promise<string> {
        try {
            const url = process.env.HUGGINGFACE_BASE_URL ?? 'https://router.huggingface.co/v1';
            const { default: axios } = await import('axios');

            const res = await axios.post(`${url.replace(/\/+$/, '')}/chat/completions`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.HUGGINGFACE_API}`
                },
                timeout: 60 * 1000
            });

            return res.data.choices[0]?.message?.content ?? '{}';
        } catch (err: any) {
            let msg = err.message;
            if (err.response?.data?.error?.message) {
                msg += ` | Details: ${err.response.data.error.message}`;
            }
            throw new InternalServerErrorException(`HuggingFace Vision failed: ${msg}`);
        }
    }

    private handleError(provider: string, err: any, model: string): never {
        const msg = err instanceof Error ? err.message : String(err);
        if (/503|Service Unavailable|overload|high demand/i.test(msg) ||
            /429|Too Many Requests|rate limit/i.test(msg)) {
            throw new ServiceUnavailableException(
                `The AI provider ${provider} (${model}) is temporarily unavailable or rate-limited. Please try again in a moment.`,
            );
        }
        throw new InternalServerErrorException(
            `${provider} request failed (model: ${model}): ${msg}`,
        );
    }
}
