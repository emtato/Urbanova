import { GoogleGenAI,ThinkingLevel } from '@google/genai';
import * as z from 'zod';
import { randomUUID } from 'node:crypto';
import { settings } from '../config.js';
import { hash } from '../core/cache.js';
import type { Store } from '../storage/store.js';
import { googleSchema,normalizeOptionalNulls } from './schema.js';
export type Generate=<T>(purpose:string,prompt:string,schema:z.ZodType<T>)=>Promise<T|null>;
export function gemini(store:Store):Generate {
  return async <T>(purpose:string,prompt:string,schema:z.ZodType<T>)=>{
    if(!settings.geminiEnabled)return null;
    const start=Date.now(),entry={call_id:randomUUID(),purpose,model:settings.model,prompt_hash:hash(prompt),status:'started',duration_ms:0};
    // If durable auditing is unavailable, skip the paid call. Forms remain usable.
    try{await store.audit(entry);}catch{return null;}
    let status='failed';
    try{
      const ai=new GoogleGenAI({apiKey:settings.geminiKey});
      const response=await ai.models.generateContent({model:settings.model,contents:prompt,config:{
        responseMimeType:'application/json',responseSchema:googleSchema(schema),
        // Bounded research choices need little deliberation. Gemini 3 supports
        // LOW; leave existing parser/explainer generation settings unchanged.
        ...(purpose.startsWith('research_')&&/^gemini-3\./.test(settings.model)?{thinkingConfig:{thinkingLevel:ThinkingLevel.LOW}}:{}),
        httpOptions:{timeout:25000},abortSignal:AbortSignal.timeout(30000),
      }});
      const result=schema.safeParse(normalizeOptionalNulls(JSON.parse(response.text??''),schema));
      if(!result.success)return null;
      status='succeeded';return result.data;
    }catch(error){
      const code=(error as {status?:number}).status;
      const message=error instanceof Error?error.message:'';
      const reason=['API_KEY_INVALID','API_KEY_EXPIRED','INVALID_ARGUMENT','NOT_FOUND','RESOURCE_EXHAUSTED','PERMISSION_DENIED'].find(value=>message.includes(value));
      status=(code&&Number.isInteger(code)?`failed_http_${code}`:'failed')+(reason?`_${reason}`:'');
      return null;
    }
    finally{
      // The initial row always exists; completion is a parameterized update.
      try{await store.audit({...entry,status,duration_ms:Date.now()-start});}
      catch{console.error(JSON.stringify({event:'ai_audit_completion_failed',call_id:entry.call_id,status}));}
    }
  };
}
