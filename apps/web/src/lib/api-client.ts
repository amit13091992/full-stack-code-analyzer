import type {
  CodebaseManifest,
  DependencyMapResponse,
  FindingsResponse,
  QueryTemplateId,
  UsageRecord,
} from '@code-analyzer/shared';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001/api';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function parseErrorOrThrow(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({ error: res.statusText }));
  throw new ApiClientError(body.error ?? `Request failed with status ${res.status}`, res.status);
}

export async function uploadZip(
  file: File,
): Promise<{ codebaseId: string; manifest: CodebaseManifest }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/codebases`, { method: 'POST', body: form });
  if (!res.ok) return parseErrorOrThrow(res);
  return res.json();
}

export async function uploadGithubUrl(
  githubUrl: string,
): Promise<{ codebaseId: string; manifest: CodebaseManifest }> {
  const res = await fetch(`${API_BASE}/codebases`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ githubUrl }),
  });
  if (!res.ok) return parseErrorOrThrow(res);
  return res.json();
}

export async function getManifest(codebaseId: string): Promise<CodebaseManifest> {
  const res = await fetch(`${API_BASE}/codebases/${codebaseId}`);
  if (!res.ok) return parseErrorOrThrow(res);
  const json = await res.json();
  return json.manifest;
}

export async function getFileContent(codebaseId: string, filePath: string): Promise<string> {
  const res = await fetch(`${API_BASE}/codebases/${codebaseId}/files/${filePath}`);
  if (!res.ok) return parseErrorOrThrow(res);
  const json = await res.json();
  return json.content;
}

export async function runQuery(
  codebaseId: string,
  query: string,
  template?: QueryTemplateId,
): Promise<{ result: FindingsResponse | DependencyMapResponse; usage: UsageRecord }> {
  const res = await fetch(`${API_BASE}/codebases/${codebaseId}/queries`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, template }),
  });
  if (!res.ok) return parseErrorOrThrow(res);
  return res.json();
}

export async function getUsage(codebaseId: string): Promise<UsageRecord> {
  const res = await fetch(`${API_BASE}/codebases/${codebaseId}/usage`);
  if (!res.ok) return parseErrorOrThrow(res);
  const json = await res.json();
  return json.usage;
}
