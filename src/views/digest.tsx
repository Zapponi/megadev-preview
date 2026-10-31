import { MISSING, type DigestRow, type Night } from '../digest/types.js';

// Plan morning-digest § 2a. One table, one row per job. A job with 3 or more retries or any
// `fail` (even one a later run recovered from) is marked; missing data reads `—`; times and
// errors are shown exactly as logged, never cut.
type FoundNight = Extract<Night, { found: true }>;

export const RETRY_MARK_AT = 3;

export const flagged = (r: DigestRow) => r.retries >= RETRY_MARK_AT || r.fails > 0;

const byJob = (a: DigestRow, b: DigestRow) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0);

function orMissing(value: string | null) {
  return value ?? <span class="mute">{MISSING}</span>;
}

export function DigestPage({ night }: { night: FoundNight }) {
  const rows = [...night.rows].sort(byJob);
  return (
    <>
      <h1>digest · {night.night}</h1>
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>fails</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr>
                <td>{flagged(r) ? <strong class="warn">{r.job}</strong> : r.job}</td>
                <td>{orMissing(r.owner)}</td>
                <td>{r.runs}</td>
                <td>{r.retries >= RETRY_MARK_AT ? <strong class="warn">{r.retries}</strong> : r.retries}</td>
                <td>{r.fails > 0 ? <strong class="warn">{r.fails}</strong> : r.fails}</td>
                <td>{r.lastStatus === 'fail' ? <strong class="warn">fail</strong> : r.lastStatus}</td>
                <td>{orMissing(r.lastError)}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {night.badLines > 0 && (
        <p class="warn">
          {night.badLines} {night.badLines === 1 ? 'line' : 'lines'} in the log didn't parse
        </p>
      )}
    </>
  );
}

export function NoNight({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="warn">no run log for this night</p>
    </>
  );
}
