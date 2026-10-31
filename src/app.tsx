import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage, NoNight } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night'));
    if (!night.found) {
      return c.html(
        <Layout title={`digest ${night.night}`} lane={lane()}>
          <NoNight night={night.night} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${night.night}`} lane={lane()}>
        <DigestPage night={night} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = readNight(config.runsDir, c.req.param('night'));
    if (!night.found) return c.json({ error: 'no log for this night', night: night.night }, 404);
    return c.json({ night: night.night, rows: night.rows, badLines: night.badLines });
  });

  return app;
}
