import { Router } from 'express';
import { ApiError } from '../core/errors.js';
import { runSimulationBatch } from '../packages/evaluate.js';
import { parse } from '../services/validate.js';
import { DeleteSimulationRequestSchema, SimulationListSchema } from '../shared/schemas.js';
import type { Store } from '../storage/store.js';

export function simulationsRouter(store: Store) {
  const r = Router();

  r.post('/run/simulation', async (q, s) => {
    const batch = await runSimulationBatch(q.body ?? {});
    const saved = await store.saveSimulation(batch);
    s.json(saved);
  });

  const handleFetch = async (_q: unknown, s: any) => {
    const list = await store.fetchSimulations();
    s.json(SimulationListSchema.parse(list));
  };
  r.get('/sim/fetch', handleFetch);
  r.post('/sim/fetch', handleFetch);

  const handleDelete = async (q: any, s: any) => {
    const rawId = q.params?.id ?? q.body?.id ?? q.query?.id;
    const { id } = parse(DeleteSimulationRequestSchema, { id: rawId });
    const deleted = await store.deleteSimulation(id);
    if (!deleted) throw new ApiError(404, 'Simulation not found.');
    s.json({ id, deleted: true });
  };
  r.post('/sim/delete', handleDelete);
  r.delete('/sim/delete', handleDelete);
  r.delete('/sim/delete/:id', handleDelete);

  return r;
}
