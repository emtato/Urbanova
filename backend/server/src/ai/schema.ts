import { Type,type Schema } from '@google/genai';
import * as z from 'zod';
// The configured model accepts responseSchema, but rejected responseJsonSchema.
// Generate from Zod once, then translate the supported SDK schema vocabulary.
// Strict keys and all constraints are still enforced by Zod after generation.
export function googleSchema(schema:z.ZodType):Schema {
  const convert=(node:any):Schema=>{
    if(node.$ref||node.anyOf)throw Error('AI schemas must be inline and non-union.');
    const type=({object:Type.OBJECT,array:Type.ARRAY,string:Type.STRING,integer:Type.INTEGER,number:Type.NUMBER,boolean:Type.BOOLEAN} as Record<string,Type>)[node.type];
    if(!type)throw Error('Unsupported AI schema type');
    const result:Schema={type};
    if(node.properties){
      const required=new Set(node.required??[]);
      result.properties=Object.fromEntries(Object.entries(node.properties).map(([k,v])=>[k,{...convert(v),...(!required.has(k)?{nullable:true}:{})}]));
      result.required=Object.keys(node.properties);
    }
    if(node.items)result.items=convert(node.items);
    if(node.enum)result.enum=node.enum.map(String);
    // Keep provider constraints to types, properties, required keys and enums;
    // the model's schema subset rejects some length/numeric-bound keywords.
    // Zod enforces the complete original schema before any answer is used.
    return result;
  };
  return convert(z.toJSONSchema(schema));
}
export function normalizeOptionalNulls(value:unknown,schema:z.ZodType):unknown {
  const visit=(input:any,node:any):any=>{
    if(Array.isArray(input))return input.map(item=>visit(item,node.items??{}));
    if(input&&typeof input==='object')return Object.fromEntries(Object.entries(input).filter(([k,v])=>!(v===null&&node.properties?.[k]&&!(node.required??[]).includes(k))).map(([k,v])=>[k,visit(v,node.properties?.[k]??{})]));
    return input;
  };
  return visit(value,z.toJSONSchema(schema));
}
