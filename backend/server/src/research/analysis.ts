import { reviewed } from '../services/bundle.js';
import { append, type Investigation,type Recipe,type Experiment,type Knob } from './contracts.js';

export function recipes(a:Investigation):Recipe[]{
  const incoming=a.request.incoming_load_range;
  const base:Recipe={id:'central',incoming_load_range:incoming,demand_factor:1,headway_s:reviewed.inputs.headway_s,new_homes:true};
  if(a.stage==='followup'){
    const r=a.redirect!;
    const evidence=a.notes.filter(n=>n.knob===a.selection!.knob).at(-1);
    const next={...base,id:'human_redirect',incoming_load_range:r.incoming_load_range??evidence?.incoming_load_range??incoming,
      demand_factor:({low:.8,central:1,high:1.2})[r.demand_case??evidence?.demand_case??'central'],
      headway_s:r.no_extra_vehicles?base.headway_s:(r.headway_s??evidence?.headway_s??(a.selection!.knob==='service_frequency'?base.headway_s*.75:base.headway_s))};
    // Always test the human constraint, then the agent's chosen remaining knob.
    const low={...next,id:'followup_low'}, high={...next,id:'followup_high'};
    if(a.selection!.knob==='incoming_load'){low.incoming_load_range=[next.incoming_load_range[0],next.incoming_load_range[0]];high.incoming_load_range=[next.incoming_load_range[1],next.incoming_load_range[1]];}
    if(a.selection!.knob==='demand_case'){low.demand_factor=.8;high.demand_factor=1.2;}
    if(a.selection!.knob==='service_frequency'){low.headway_s=base.headway_s;high.headway_s=r.headway_s??base.headway_s*.75;}
    return [next,low,high];
  }
  return [base,{...base,id:'incoming_low',incoming_load_range:[incoming[0],incoming[0]]},
    {...base,id:'incoming_high',incoming_load_range:[incoming[1],incoming[1]]},
    {...base,id:'no_new_homes',new_homes:false},
    {...base,id:'demand_low',demand_factor:.8},{...base,id:'demand_high',demand_factor:1.2},
    {...base,id:'extra_service',headway_s:base.headway_s*.75}];
}
export function values(e:Experiment,stop:string):Array<number|null>{return e.runs.map(r=>{
  const s=r.summary.by_stop.find((s:any)=>s.stop_id===stop);
  return s?.by_rider_group.existing.denied_at_least_once_share??null;
});}
const mean=(a:number[])=>a.reduce((s,x)=>s+x,0)/a.length;
export function paired(arrays:Array<Array<number|null>>,formula:(v:number[])=>number,minimum=0){
  if(new Set(arrays.map(a=>a.length)).size!==1)throw Error('Unmatched run counts');
  const deltas=arrays[0].flatMap((_,i)=>arrays.every(a=>a[i]!==null)?[formula(arrays.map(a=>a[i]!))]:[]);
  if(deltas.length<3)return {classification:'inconclusive',paired_deltas:deltas,valid_pairs:deltas.length,mean:null,stddev:null,interval_95:null};
  const avg=mean(deltas),sd=Math.sqrt(deltas.reduce((s,x)=>s+(x-avg)**2,0)/(deltas.length-1));
  const t=[0,12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,2.201,2.179,2.16,2.145,2.131,2.12,2.11,2.101,2.093][deltas.length-1];
  const interval=[avg-t*sd/Math.sqrt(deltas.length),avg+t*sd/Math.sqrt(deltas.length)];
  return {classification:interval[0]>minimum?'supported':interval[1]<=minimum?'contradicted':'inconclusive',paired_deltas:deltas,valid_pairs:deltas.length,mean:avg,stddev:sd,interval_95:interval};
}
export function validatePairing(experiments:Experiment[],seeds:number[]){
  for(const e of experiments){
    if(JSON.stringify(e.runs.map(r=>r.inputs.seed))!==JSON.stringify(seeds))throw Error('Seed mismatch');
    if(e.runs.some(r=>r.summary.overview.conservation_valid!==true))throw Error('Conservation failed');
  }
  const groups=new Map<string,Experiment[]>();
  for(const e of experiments){const k=String(e.recipe.demand_factor);groups.set(k,[...(groups.get(k)??[]),e]);}
  for(const group of groups.values())for(const e of group)for(let i=0;i<seeds.length;i++)
    if(e.runs[i].inputs.existing_cohort_signature!==group[0].runs[i].inputs.existing_cohort_signature)throw Error('Existing housing cohort changed within a controlled experiment');
}
export function selectNext(a:Investigation){
  const e=Object.fromEntries(a.experiments.map(x=>[x.recipe.id,x]));
  const pairs:{knob:Knob;ids:[string,string]}[]=[{knob:'incoming_load',ids:['incoming_low','incoming_high']},{knob:'demand_case',ids:['demand_low','demand_high']},{knob:'service_frequency',ids:['central','extra_service']}];
  const scores=pairs.filter(p=>!(a.redirect?.no_extra_vehicles&&p.knob==='service_frequency')).map(p=>{
    const result=paired(p.ids.map(id=>values(e[id],a.stop_id!)),v=>v[1]-v[0]);
    // Notes are human judgments, not observed corridor baselines. Mere presence
    // reduces the priority slightly; it never turns an assumption into fact.
    const weakness=a.notes.some(n=>n.knob===p.knob)?.75:1;
    return {knob:p.knob,sensitivity:result.mean===null?null:Math.abs(result.mean),evidence_weakness:weakness,
      score:result.mean===null?null:Math.abs(result.mean)*weakness,variation:result};
  }).sort((x,y)=>(y.score??-1)-(x.score??-1));
  if(scores.every(s=>s.score===null))return {knob:'incoming_load' as Knob,reason:'No valid paired stop shares; prioritize the unobserved incoming-load baseline for human review.',scores};
  return {knob:scores[0].knob,reason:'Largest measured absolute paired change × evidence weakness among permitted knobs. Equal scores use incoming load, demand, then service order. Exploratory stop selection is not a confirmatory causal test.',scores};
}
export function assess(a:Investigation){
  const e=Object.fromEntries(a.experiments.map(x=>[x.recipe.id,x]));
  if(!a.stop_id){
    const stops=e.central.runs[0].summary.by_stop.map((s:any)=>s.stop_id) as string[];
    a.stop_id=stops.sort((x,y)=>{
      const usable=(id:string)=>{const v=values(e.central,id).filter((v):v is number=>v!==null);return v.length?mean(v):-1;};
      return usable(y)-usable(x);
    })[0];
    append(a,'stop_selected',{stop_id:a.stop_id,method:'Highest mean existing-rider denied share in central runs; exploratory, including zero if no denied boarding is present.'});
  }
  const result=paired(['incoming_high','incoming_low','central','no_new_homes'].map(id=>values(e[id],a.stop_id!)),v=>(v[0]-v[1])-(v[2]-v[3]),a.request.minimum_effect);
  const central=values(e.central,a.stop_id!).filter((v):v is number=>v!==null);
  a.finding={stop_id:a.stop_id,prediction:'At this stop, high minus low incoming load increases existing-rider denied share more than adding new homes at central incoming load, by the preregistered minimum effect.',minimum_effect:a.request.minimum_effect,
    central_existing_denied_share_mean:central.length?mean(central):null,
    premise:!central.length?'No valid existing-rider stop share: the premise cannot be assessed.':central.every(v=>v===0)?'No existing-rider denied boarding was reproduced at this stop in the central runs. The premise of a worsening stop is not established.':'Existing-rider denied boarding occurs in the central model runs; its real-world baseline remains unobserved.',
    ...result,incoming_effect:paired(['incoming_high','incoming_low'].map(id=>values(e[id],a.stop_id!)),v=>v[0]-v[1]),housing_effect:paired(['central','no_new_homes'].map(id=>values(e[id],a.stop_id!)),v=>v[0]-v[1]),
    method:'Paired run differences; two-sided Student-t 95% interval of mean contrast. Exploratory selected stop; no multiplicity correction; not a TTC observation.',
    conditions:{incoming_load_range:a.request.incoming_load_range,headway_s:e.central.recipe.headway_s,demand_factor:1,seeds:a.request.seeds},
    limitation:'Only tested bounds are supported. No threshold, observed baseline, real-world attribution, or package feasibility is inferred.'};
  append(a,'hypothesis_evaluated',a.finding);
  a.selection=selectNext(a);append(a,'next_experiment_selected',a.selection);
}
