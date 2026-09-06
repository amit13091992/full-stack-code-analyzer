import type { CodebaseManifest } from '@code-analyzer/shared';
import type { Db } from './index.js';

export class CodebaseRepo {
  constructor(private db: Db) {}

  save(manifest: CodebaseManifest, fileContents: Map<string, string>): void {
    const insertCodebase = this.db.prepare(
      `INSERT INTO codebases (id, manifest_json, content_hash, created_at)
       VALUES (@id, @manifest_json, @content_hash, @created_at)
       ON CONFLICT(id) DO UPDATE SET manifest_json = excluded.manifest_json,
         content_hash = excluded.content_hash, created_at = excluded.created_at`,
    );
    insertCodebase.run({
      id: manifest.codebaseId,
      manifest_json: JSON.stringify(manifest),
      content_hash: manifest.contentHash,
      created_at: manifest.createdAt,
    });

    const deleteFiles = this.db.prepare(`DELETE FROM codebase_files WHERE codebase_id = ?`);
    deleteFiles.run(manifest.codebaseId);

    const insertFile = this.db.prepare(
      `INSERT INTO codebase_files (codebase_id, path, content, is_high_signal)
       VALUES (@codebase_id, @path, @content, @is_high_signal)`,
    );
    const insertMany = this.db.transaction((entries: [string, string][]) => {
      for (const [filePath, content] of entries) {
        insertFile.run({
          codebase_id: manifest.codebaseId,
          path: filePath,
          content,
          is_high_signal: 1,
        });
      }
    });
    insertMany([...fileContents.entries()]);

    // Invalidate any stale cached context block for this codebase — new content hash
    // means the leading context block must be rebuilt, never reused across content changes.
    this.db.prepare(`DELETE FROM context_blocks WHERE codebase_id = ?`).run(manifest.codebaseId);
  }

  getManifest(codebaseId: string): CodebaseManifest | undefined {
    const row = this.db
      .prepare(`SELECT manifest_json FROM codebases WHERE id = ?`)
      .get(codebaseId) as { manifest_json: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.manifest_json) as CodebaseManifest;
  }

  getHighSignalFileContents(codebaseId: string): Map<string, string> {
    const rows = this.db
      .prepare(`SELECT path, content FROM codebase_files WHERE codebase_id = ?`)
      .all(codebaseId) as { path: string; content: string }[];
    return new Map(rows.map((r) => [r.path, r.content]));
  }

  getFileContent(codebaseId: string, filePath: string): string | undefined {
    const row = this.db
      .prepare(`SELECT content FROM codebase_files WHERE codebase_id = ? AND path = ?`)
      .get(codebaseId, filePath) as { content: string } | undefined;
    return row?.content;
  }
}
