import { type KnowledgeNote,type Knob,type Investigation } from './contracts.js';

// Sponsor transport belongs behind this port once its real protocol is known.
// There is deliberately no invented Papiers REST URL or success response.
export interface KnowledgeLibrary {
  mode:'unconnected'|'papiers_live';
  readOnly?:boolean;
  read(knob:Knob):Promise<{notes:KnowledgeNote[];receipt?:{document_id:string;retrieved_at:string}}>;
  write(a:Investigation):Promise<{receipt:string}>;
}
export const unconnectedLibrary:KnowledgeLibrary={mode:'unconnected',async read(){return {notes:[]};},async write(){throw Error('Papiers connection has not been verified');}};
