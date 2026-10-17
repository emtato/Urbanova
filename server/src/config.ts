import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

export const ROOT = resolve(process.cwd(), existsSync('data/contracts') ? '.' : '..');
config({ path: resolve(ROOT, '.env'), quiet: true });
export const settings = {
  port: Number(process.env.PORT ?? 8010),
  databaseUrl: process.env.DATABASE_URL,
  model: process.env.GEMINI_MODEL ?? 'gemini-3.8-flash',
  modelVersion: process.env.MODEL_VERSION ?? 'lane-c-b11-v1',
  origins: process.env.CORS_ORIGINS ? JSON.parse(process.env.CORS_ORIGINS) as string[] : ['http://localhost:5173', 'http://127.0.0.1:5173'],
};
