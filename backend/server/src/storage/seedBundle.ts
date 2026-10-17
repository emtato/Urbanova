import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Pool} from 'pg';
import {ROOT} from '../config.js';
import {dataVersion,reviewed,rawCorridor,sourceManifest,interventionCatalog} from '../services/bundle.js';
const read=(file:string)=>JSON.parse(readFileSync(resolve(ROOT,'data/reviewed',file),'utf8'));
/** Atomic, immutable source snapshot: no upstream network access during startup. */
export async function seedBundle(pool:Pool){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[dataVersion]);
    if((await client.query('SELECT 1 FROM a_bundles WHERE data_version=$1',[dataVersion])).rowCount){await client.query('COMMIT');return;}
    const extra=read('workplaces_sources.json'),sources=[...sourceManifest,...(Array.isArray(extra)?extra:extra.sources).filter((s:any)=>!sourceManifest.some(a=>a.source_id===s.source_id))];
    for(const source of sources)await client.query('INSERT INTO a_sources VALUES($1,$2,$3)',[dataVersion,source.source_id,source]);
    for(const stop of reviewed.inputs.stops)await client.query('INSERT INTO a_stops VALUES($1,$2,$3,$4,ST_SetSRID(ST_MakePoint($5,$6),4326),$7)',[dataVersion,stop.id,stop.name,stop.sequence,stop.longitude,stop.latitude,stop]);
    for(const link of rawCorridor.links)await client.query('INSERT INTO a_links VALUES($1,$2,$3,$4,$5,ST_SetSRID(ST_GeomFromGeoJSON($6),4326),$7)',[dataVersion,link.link_id,link.from_stop,link.to_stop,link.length_m,JSON.stringify(link.geometry),link]);
    for(const development of reviewed.inputs.developments)await client.query('INSERT INTO a_developments VALUES($1,$2,ST_SetSRID(ST_MakePoint($3,$4),4326),$5)',[dataVersion,development.id,development.longitude,development.latitude,{...development,evidence:reviewed.evidence.developments.find((d:any)=>d.id===development.id)}]);
    const alternatives=read('walking_alternatives.geojson').features;
    const walks=[...read('walking_access.json')];
    for(const feature of alternatives){const p=feature.properties;if(!walks.some(w=>w.dev_id===p.entity_id&&w.stop_id===p.stop_id))walks.push({...p,dev_id:p.entity_id});}
    for(const walk of walks){const geometry=alternatives.find((f:any)=>f.properties.entity_id===walk.dev_id&&f.properties.stop_id===walk.stop_id)?.geometry;await client.query('INSERT INTO a_walking_access(data_version,development_id,stop_id,walk_m,review_status,payload,geom) VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $7::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($7),4326) END)',[dataVersion,walk.dev_id,walk.stop_id,walk.walk_m,walk.manual_review,walk,geometry?JSON.stringify(geometry):null]);}
    for(const intervention of interventionCatalog.catalogue)await client.query('INSERT INTO a_interventions VALUES($1,$2,$3)',[dataVersion,intervention.id,intervention]);
    await client.query('INSERT INTO a_bundles VALUES($1,$2,now())',[dataVersion,{reviewed,corridor:rawCorridor,sources,interventions:interventionCatalog,walking_access:walks,workplaces:read('workplaces_2021.json'),line1_stations:read('line1_stations.json')}]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
