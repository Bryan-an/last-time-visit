import { Hono } from 'https://deno.land/x/hono@v3.11.8/mod.ts';
import { serveStatic } from 'https://deno.land/x/hono@v3.11.8/middleware.ts';
import { streamSSE } from 'https://deno.land/x/hono@v3.11.8/helper/streaming/index.ts';

interface ILastVisit {
  country: string;
  city: string;
  flag: string;
}

const db = await Deno.openKv();
const app = new Hono();
let i = 0;

app.get('/', serveStatic({ path: './index.html' }));

app.post('/visit', async (c) => {
  const { city, flag, country } = await c.req.json<ILastVisit>();

  await db
    .atomic()
    .set(['lastVisit'], { country, city, flag })
    .sum(['visits'], 1n)
    .commit();

  return c.json({ message: 'ok' });
});

app.get('/visit', (c) => {
  return streamSSE(c, async (stream) => {
    const watcher = db.watch<[ILastVisit]>([['lastVisit']]);

    for await (const entry of watcher) {
      const { value } = entry[0];

      if (value != null) {
        await stream.writeSSE({
          data: JSON.stringify(value),
          event: 'update',
          id: String(i++),
        });
      }
    }
  });
});

// app.get('/counter', (c) => {
//   return streamSSE(c, async (stream) => {
//     const watcher = db.watch<[Deno.KvU64]>([['visits']]);

//     for await (const entry of watcher) {
//       const { value } = entry[0];

//       if (value != null) {
//         await stream.writeSSE({
//           data: value?.value.toString() ?? '0',
//           event: 'update',
//           id: String(i++),
//         });
//       }
//     }

// while (true) {
//   const { value } = await db.get<Deno.KvU64>(['visits']);

//   await stream.writeSSE({
//     data: value?.value.toString() ?? '0',
//     event: 'update',
//     id: String(i++),
//   });

//   await stream.sleep(1000);
// }
//   });
// });

Deno.serve(app.fetch);
