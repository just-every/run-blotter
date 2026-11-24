// Wraps the emitted Worker so every D1 statement reports the rows it read, per door.
// Real workerd, real D1: d1-budget.test.mjs reads the log from /__d1_meter, which drains it.
export function meteredWorker(app) {
 let log = [];
 const pending = new Set();

 function observe(door, statements, operation) {
  const work = operation().then(result => {
   const results = Array.isArray(result) ? result : [result];
   statements.forEach(({sql}, index) => {
    const {rows_read: rows, rows_written: writes} = results[index]?.meta ?? {};
    log.push({door, sql, rows: Number.isSafeInteger(rows) ? rows : null, writes: writes ?? 0});
   });
   return result;
  });
  pending.add(work);
  work.then(() => pending.delete(work), () => pending.delete(work));
  return work;
 }

 function meterBinding(db, door) {
  const known = new WeakMap();
  function wrap(statement, sql) {
   const entry = {statement, sql};
   const wrapped = {
    bind: (...values) => wrap(statement.bind(...values), sql),
    run: () => observe(door, [entry], () => statement.run()),
    all: () => observe(door, [entry], () => statement.all()),
    async first(column) {
     // first() discards the metadata; read the same result through all().
     const row = (await observe(door, [entry], () => statement.all())).results[0];
     if (!row) return null;
     return column === undefined ? row : row[column];
    },
    async raw(options) {
     const result = await observe(door, [entry], () => statement.all());
     const rows = result.results.map(row => Object.values(row));
     return options?.columnNames ? [Object.keys(result.results[0] ?? {}), ...rows] : rows;
    },
   };
   known.set(wrapped, entry);
   return wrapped;
  }
  return {
   prepare: sql => wrap(db.prepare(sql), sql.replace(/\s+/g, ' ').trim()),
   batch(statements) {
    const entries = statements.map(statement => known.get(statement));
    return observe(door, entries, () => db.batch(entries.map(({statement}) => statement)));
   },
  };
 }

 async function measure(door, env, ctx, run) {
  const waiting = new Set();
  try {
   return await run({...env, DB: meterBinding(env.DB, door)}, {
    waitUntil(promise) { waiting.add(promise); ctx.waitUntil(promise); },
    passThroughOnException: () => ctx.passThroughOnException(),
   });
  } finally {
   // Work handed to waitUntil belongs to the request that started it.
   await Promise.allSettled([...waiting]);
   while (pending.size) await Promise.allSettled([...pending]);
  }
 }

 return {
  fetch(request, env, ctx) {
   const url = new URL(request.url);
   if (url.pathname === '/__d1_meter') {
    const drained = log;
    log = [];
    return Response.json(drained);
   }
   return measure(`${request.method} ${url.pathname}`, env, ctx, (bindings, context) => app.fetch(request, bindings, context));
  },
  scheduled(controller, env, ctx) {
   return measure('cron', env, ctx, (bindings, context) => app.scheduled(controller, bindings, context));
  },
 };
}
