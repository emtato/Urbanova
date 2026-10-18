import { Router } from 'express';
import * as z from 'zod';
import { parse } from '../services/validate.js';
import { copilot } from '../ai/copilot.js';
import type { Generate } from '../ai/gemini.js';
export function chatRouter(generate:Generate){const r=Router();r.post('/',async(q,s)=>{const {question}=parse(z.strictObject({question:z.string().trim().min(1).max(2000)}),q.body);s.json(await copilot(question,generate));});return r;}
