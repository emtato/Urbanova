import { PgStore } from './store.js';
const store=new PgStore();
try {await store.init();console.log('Lane C PostgreSQL schema and reviewed access initialized.');}
finally{await store.close();}
