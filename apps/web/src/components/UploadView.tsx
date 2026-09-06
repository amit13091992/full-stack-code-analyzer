import { useState } from 'react';
import type { CodebaseManifest } from '@code-analyzer/shared';
import { uploadGithubUrl, uploadZip, ApiClientError } from '../lib/api-client.js';

export interface UploadViewProps {
  onIngested: (result: { codebaseId: string; manifest: CodebaseManifest }) => void;
}

type Status = 'idle' | 'uploading' | 'error';

export default function UploadView({ onIngested }: UploadViewProps) {
  const [githubUrl, setGithubUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function runUpload(action: () => Promise<{ codebaseId: string; manifest: CodebaseManifest }>) {
    setStatus('uploading');
    setError(null);
    try {
      const result = await action();
      setStatus('idle');
      onIngested(result);
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiClientError ? err.message : 'Failed to ingest codebase.');
    }
  }

  function handleFile(file: File) {
    if (!file.name.endsWith('.zip')) {
      setStatus('error');
      setError('Invalid file type: only .zip archives are supported.');
      return;
    }
    void runUpload(() => uploadZip(file));
  }

  function handleGithubSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!githubUrl.trim()) return;
    void runUpload(() => uploadGithubUrl(githubUrl.trim()));
  }

  return (
    <section className="space-y-6" aria-label="Upload codebase">
      <form onSubmit={handleGithubSubmit} className="flex gap-2">
        <label htmlFor="github-url" className="sr-only">
          GitHub repository URL
        </label>
        <input
          id="github-url"
          type="text"
          placeholder="https://github.com/owner/repo"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          className="flex-1 rounded border border-slate-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={status === 'uploading'}
          className="rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
        >
          Clone
        </button>
      </form>

      <div
        role="button"
        tabIndex={0}
        aria-label="ZIP dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => document.getElementById('zip-input')?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') document.getElementById('zip-input')?.click();
        }}
        className={`rounded border-2 border-dashed p-8 text-center ${
          dragActive ? 'border-slate-600 bg-slate-100' : 'border-slate-300'
        }`}
      >
        <input
          id="zip-input"
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <p>Drag &amp; drop a ZIP file here, or click to select one.</p>
      </div>

      {status === 'uploading' && <p role="status">Ingesting codebase…</p>}
      {status === 'error' && error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
