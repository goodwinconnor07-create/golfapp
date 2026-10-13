import { DurableObject } from 'cloudflare:workers';

/**
 * Saved GolfCourseAPI answers, so the same course or search is only fetched once.
 * There's a single instance (named "courses"); entries are small JSON strings.
 */
export class CourseStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS saved (key TEXT PRIMARY KEY, body TEXT NOT NULL, saved_at INTEGER NOT NULL)');
  }

  /** The saved JSON for a key, or null if it's missing or older than maxAgeMs. */
  get(key: string, maxAgeMs: number): string | null {
    const row = this.ctx.storage.sql
      .exec<{ body: string; saved_at: number }>('SELECT body, saved_at FROM saved WHERE key = ?', key)
      .toArray()[0];
    return row && Date.now() - row.saved_at < maxAgeMs ? row.body : null;
  }

  put(key: string, body: string): void {
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO saved (key, body, saved_at) VALUES (?, ?, ?)', key, body, Date.now());
  }
}
