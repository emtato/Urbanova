import {PgStore} from '../storage/store.js';
import {dataVersion} from '../services/bundle.js';
const store=new PgStore();
try{await store.init();const counts:Record<string,number>={};for(const table of ['a_sources','a_stops','a_links','a_developments','a_walking_access','a_interventions'])counts[table]=(await store.pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE data_version=$1`,[dataVersion])).rows[0].n;console.log(JSON.stringify({status:'ok',data_version:dataVersion,counts}));}
catch{console.error('Bundle seed failed; check the database connection, PostGIS permissions and reviewed input files.');process.exitCode=1;}
finally{await store.close();}
