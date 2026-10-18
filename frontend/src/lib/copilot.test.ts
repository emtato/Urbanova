import {afterEach,describe,it,expect,vi} from 'vitest'
import {askCopilot,interpretedFields,reviewedCopilotInput,runCopilotExperiment,investigateFromChat,type CopilotReply} from './copilot'
import {API_BASE_URL,runSimulation} from './api'
vi.mock('./api',async original=>({...await original<typeof import('./api')>(),runSimulation:vi.fn()}))
const answer:CopilotReply={kind:'patch',answer:'Review the proposed headway.',patch:{headway_s:180},defaults:{headway_s:419.8125},fallback:false,data_version:'reviewed',model_version:'b11'}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();vi.clearAllMocks()})
describe('live chat workflow',()=>{
 it('sends typed text to the backend and shows actual reviewed defaults',async()=>{
  const fetch=vi.fn(async(_url:string,_options?:RequestInit)=>new Response(JSON.stringify(answer)));vi.stubGlobal('fetch',fetch)
  const result=await askCopilot(' Set headway to 3 minutes ')
  expect(fetch.mock.calls[0][0]).toBe(API_BASE_URL+'/chat')
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({question:'Set headway to 3 minutes'})
  expect(interpretedFields(result)[0]).toMatchObject({originalValue:419.8125,interpretedValue:180})
 })
 it('never invents fields for an unsupported answer or provider outage',async()=>{
  expect(interpretedFields({...answer,kind:'unsupported',patch:{}})).toEqual([])
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'Backend unavailable'}),{status:503})))
  await expect(askCopilot('hello')).rejects.toThrow('Backend unavailable')
 })
 it('uses edited values for a real native simulation and propagates failure',async()=>{
  const fields=interpretedFields(answer);fields[0].interpretedValue='240'
  vi.mocked(runSimulation).mockResolvedValueOnce({id:'saved-batch'} as never)
  expect(await runCopilotExperiment(fields)).toMatchObject({id:'saved-batch'})
  expect(runSimulation).toHaveBeenCalledWith({headway_s:240,run_count:1,seeds:[42]},undefined)
  vi.mocked(runSimulation).mockRejectedValueOnce(Error('Computation failed'))
  await expect(runCopilotExperiment(fields)).rejects.toThrow('Computation failed')
 })
 it('rejects empty, nonnumeric and malformed edits before creating a simulation',()=>{
  for(const value of ['', 'not a number', '-1', 'Infinity'])expect(()=>reviewedCopilotInput([{...interpretedFields(answer)[0],interpretedValue:value}])).toThrow()
  expect(()=>reviewedCopilotInput([])).toThrow()
 })
 it('runs real research endpoints and submits only a user-selected constraint',async()=>{
  const responses=[{id:'audit',status:'queued'},{id:'audit',status:'awaiting_human',finding:{premise:'No denial reproduced'}},{id:'audit',status:'completed'}]
  const fetch=vi.fn(async()=>new Response(JSON.stringify(responses.shift())));vi.stubGlobal('fetch',fetch);vi.useFakeTimers()
  const pending=investigateFromChat({stopId:'reviewed-stop'})
  await vi.advanceTimersByTimeAsync(1000);expect((await pending).status).toBe('awaiting_human')
  expect((await investigateFromChat({id:'audit'})).status).toBe('completed')
  expect(fetch.mock.calls.map(call=>String((call as unknown[])[0]))).toEqual(['/investigations','/investigations/audit','/investigations/audit/redirect'].map(p=>API_BASE_URL+p))
 })
})
