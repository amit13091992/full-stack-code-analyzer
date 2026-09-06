import type { Db } from './index.js';

export interface StoredContextBlock {
  codebaseId: string;
  contentHash: string;
  blockText: string;
}

export class ContextBlockRepo {
  constructor(private db: Db) {}

  get(codebaseId: string): StoredContextBlock | undefined {
    const row = this.db
      .prepare(`SELECT codebase_id, content_hash, block_text FROM context_blocks WHERE codebase_id = ?`)
      .get(codebaseId) as { codebase_id: string; content_hash: string; block_text: string } | undefined;
    if (!row) return undefined;
    return { codebaseId: row.codebase_id, contentHash: row.content_hash, blockText: row.block_text };
  }

  upsert(block: StoredContextBlock): void {
    this.db
      .prepare(
        `INSERT INTO context_blocks (codebase_id, content_hash, block_text, created_at)
         VALUES (@codebase_id, @content_hash, @block_text, @created_at)
         ON CONFLICT(codebase_id) DO UPDATE SET
           content_hash = excluded.content_hash,
           block_text = excluded.block_text,
           created_at = excluded.created_at`,
      )
      .run({
        codebase_id: block.codebaseId,
        content_hash: block.contentHash,
        block_text: block.blockText,
        created_at: new Date().toISOString(),
      });
  }
}
