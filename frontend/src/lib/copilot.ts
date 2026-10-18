import { apiRequest,runSimulation } from './api'
import type { RunSimulationRequest } from './liveTypes'
export interface InterpretedField {key:string;label:string;originalValue:string|number;interpretedValue:string|number;unit:string;description:string}
export type CopilotPatch=Pick<RunSimulationRequest,'headway_s'|'streetcar_capacity'|'trips_per_resident_in_window'|'incoming_load_range'|'development_ids'>
export interface CopilotReply {kind:'patch'|'answer'|'unsupported';answer:string;patch:CopilotPatch;defaults:CopilotPatch;fallback:boolean;data_version:string;model_version:string;investigate?:boolean}
const fields:Record<string,{label:string;unit:string}>={headway_s:{label:'Streetcar headway',unit:'seconds'},streetcar_capacity:{label:'Streetcar capacity',unit:'passengers'},trips_per_resident_in_window:{label:'Trips per resident in peak window',unit:'trips/resident'},incoming_load_range:{label:'Incoming load range',unit:'[low, high] passengers'},development_ids:{label:'Included developments',unit:'JSON array of reviewed IDs'}}
const display=(value:unknown)=>typeof value==='number'?value:JSON.stringify(value??[])
export async function askCopilot(question:string,signal?:AbortSignal){
  const result=await apiRequest<CopilotReply>('/chat',{question:question.trim()},signal)
  if(!result||!['patch','answer','unsupported'].includes(result.kind)||typeof result.answer!=='string'||!result.patch||!result.defaults)throw Error('Invalid copilot response')
  if(Object.keys(result.patch).some(key=>!fields[key]))throw Error('Copilot returned an unsupported input')
  return result
}
export function interpretedFields(reply:CopilotReply):InterpretedField[]{
  if(reply.kind!=='patch')return []
  return Object.entries(reply.patch).map(([key,value])=>({key,...fields[key],originalValue:display(reply.defaults[key as keyof CopilotPatch]),interpretedValue:display(value),description:'Proposed backend input. Review before running B11; this is not a computed outcome.'}))
}
export function reviewedCopilotInput(changes:InterpretedField[]):CopilotPatch{
  if(!changes.length)throw Error('Interpret a supported input change before running.')
  const input:Record<string,unknown>={}
  for(const change of changes){
    if(!fields[change.key])throw Error('Unsupported simulation input')
    const raw=String(change.interpretedValue).trim()
    if(!raw)throw Error(`${change.label} is required`)
    if(change.key==='incoming_load_range'||change.key==='development_ids'){
      let value:unknown;try{value=JSON.parse(raw)}catch{throw Error(`${change.label} must be a JSON array`)}
      if(!Array.isArray(value))throw Error(`${change.label} must be a JSON array`)
      if(change.key==='development_ids'&&!value.every(v=>typeof v==='string'))throw Error('Development IDs must be strings')
      if(change.key==='incoming_load_range'&&(value.length!==2||!value.every(v=>Number.isInteger(v)&&v>=0)||value[0]>value[1]))throw Error('Incoming load must be an ordered pair of nonnegative integers')
      input[change.key]=value
    }else{
      const value=Number(raw)
      if(!Number.isFinite(value)||value<0)throw Error(`${change.label} must be a finite nonnegative number`)
      if(change.key==='headway_s'&&(value<60||value>3600))throw Error('Headway must be between 60 and 3600 seconds')
      if(change.key==='streetcar_capacity'&&(!Number.isInteger(value)||value<1))throw Error('Capacity must be a positive integer')
      if(change.key==='trips_per_resident_in_window'&&value>10)throw Error('Trip rate must be between 0 and 10')
      input[change.key]=value
    }
  }
  return input as CopilotPatch
}
export const runCopilotExperiment=(changes:InterpretedField[],signal?:AbortSignal)=>runSimulation({...reviewedCopilotInput(changes),run_count:1,seeds:[42]},signal)
export interface ChatInvestigation {id:string;status:'queued'|'running'|'awaiting_human'|'completed'|'failed';error?:string;finding?:{premise?:string;classification?:string;resident_answer?:string}}
export async function investigateFromChat(options:{id?:string;stopId?:string;signal?:AbortSignal;onProgress?:(a:ChatInvestigation)=>void}={}){
  const {signal}=options
  let result=options.id?await apiRequest<ChatInvestigation>(`/investigations/${encodeURIComponent(options.id)}/redirect`,{author:'Chat user',note:'No extra vehicles at move-in; keep current service frequency',no_extra_vehicles:true},signal):await apiRequest<ChatInvestigation>('/investigations',{seeds:[101,102,103],...(options.stopId?{stop_id:options.stopId}:{})},signal)
  const deadline=Date.now()+21*60*1000
  options.onProgress?.(result)
  while(result.status==='queued'||result.status==='running'){
    if(Date.now()>deadline)throw Error(`Investigation ${result.id} is still running; open its saved replay to check progress.`)
    await new Promise<void>((accept,reject)=>{if(signal?.aborted){reject(signal.reason);return}const cancel=()=>{clearTimeout(timer);reject(signal?.reason)};const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);accept()},1000);signal?.addEventListener('abort',cancel,{once:true})})
    result=await apiRequest<ChatInvestigation>(`/investigations/${encodeURIComponent(result.id)}`,undefined,signal)
    options.onProgress?.(result)
  }
  if(result.status==='failed')throw Error(result.error??'Investigation failed; no successful result is claimed.')
  return result
}
