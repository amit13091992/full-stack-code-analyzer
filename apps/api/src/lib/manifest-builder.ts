import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { CodebaseManifest, DetectedFramework, ManifestFile } from '@code-analyzer/shared';

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage']);
const IGNORED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Pipfile.lock',
]);
const BINARY_MEDIA_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp4',
  '.mp3',
  '.zip',
  '.pdf',
  '.bin',
  '.exe',
  '.wasm',
]);

const LANGUAGE_BY_EXT: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.json': 'json',
  '.md': 'markdown',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.css': 'css',
  '.html': 'html',
};

const HIGH_SIGNAL_DIR_HINTS = ['routes', 'controllers', 'auth', 'middleware', 'config'];
const HIGH_SIGNAL_FILENAME_HINTS = [
  'index.ts',
  'index.js',
  'main.py',
  'main.ts',
  'app.ts',
  'app.py',
  'server.ts',
];

interface WalkedFile {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

function walkDir(rootDir: string, currentDir: string, out: WalkedFile[]): void {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walkDir(rootDir, path.join(currentDir, entry.name), out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (IGNORED_FILENAMES.has(entry.name)) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (BINARY_MEDIA_EXTENSIONS.has(ext)) continue;

    const absolutePath = path.join(currentDir, entry.name);
    const stat = fs.statSync(absolutePath);
    out.push({
      relativePath: path.relative(rootDir, absolutePath).split(path.sep).join('/'),
      absolutePath,
      sizeBytes: stat.size,
    });
  }
}

function detectLanguage(relativePath: string): string {
  const ext = path.extname(relativePath).toLowerCase();
  return LANGUAGE_BY_EXT[ext] ?? 'plaintext';
}

function scoreHighSignal(relativePath: string): number {
  const lower = relativePath.toLowerCase();
  const base = path.basename(lower);
  let score = 0;
  if (HIGH_SIGNAL_FILENAME_HINTS.includes(base)) score += 10;
  for (const hint of HIGH_SIGNAL_DIR_HINTS) {
    if (lower.includes(`/${hint}/`) || lower.startsWith(`${hint}/`)) score += 8;
  }
  if (base === 'package.json' || base === 'requirements.txt' || base.startsWith('.env')) {
    score += 5;
  }
  if (base.endsWith('.config.ts') || base.endsWith('.config.js')) score += 3;
  return score;
}

function detectFrameworksFromPackageJson(content: string): DetectedFramework[] {
  try {
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const known = ['react', 'express', 'hono', 'next', 'vue', 'fastify', 'nestjs', '@nestjs/core'];
    const found: DetectedFramework[] = [];
    for (const name of known) {
      if (deps[name]) {
        found.push({ name, source: 'package.json', version: deps[name] });
      }
    }
    return found;
  } catch {
    return [];
  }
}

function detectFrameworksFromRequirementsTxt(content: string): DetectedFramework[] {
  const known = ['django', 'flask', 'fastapi', 'pandas', 'numpy'];
  const found: DetectedFramework[] = [];
  const lower = content.toLowerCase();
  for (const name of known) {
    if (lower.includes(name)) {
      found.push({ name, source: 'requirements.txt' });
    }
  }
  return found;
}

export function contentHashOf(parts: string[]): string {
  const hash = crypto.createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest('hex');
}

export interface BuildManifestOptions {
  codebaseId: string;
  sourceType: 'zip' | 'github';
  sourceRef: string;
  rootDir: string;
  tokenBudget: number;
}

export interface BuiltManifest {
  manifest: CodebaseManifest;
  highSignalFileContents: Map<string, string>;
}

const APPROX_CHARS_PER_TOKEN = 4;

export function buildManifest(options: BuildManifestOptions): BuiltManifest {
  const walked: WalkedFile[] = [];
  walkDir(options.rootDir, options.rootDir, walked);

  const files: ManifestFile[] = [];
  const frameworks: DetectedFramework[] = [];
  const scored: { file: WalkedFile; score: number; content: string; lineCount: number }[] = [];

  for (const w of walked) {
    const content = fs.readFileSync(w.absolutePath, 'utf-8');
    const lineCount = content.length === 0 ? 0 : content.split('\n').length;
    const score = scoreHighSignal(w.relativePath);
    scored.push({ file: w, score, content, lineCount });

    if (path.basename(w.relativePath) === 'package.json') {
      frameworks.push(...detectFrameworksFromPackageJson(content));
    }
    if (path.basename(w.relativePath) === 'requirements.txt') {
      frameworks.push(...detectFrameworksFromRequirementsTxt(content));
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const highSignalFiles: string[] = [];
  const highSignalFileContents = new Map<string, string>();
  let budgetUsedChars = 0;
  const budgetChars = options.tokenBudget * APPROX_CHARS_PER_TOKEN;

  for (const s of scored) {
    if (s.score <= 0) continue;
    if (budgetUsedChars + s.content.length > budgetChars) continue;
    highSignalFiles.push(s.file.relativePath);
    highSignalFileContents.set(s.file.relativePath, s.content);
    budgetUsedChars += s.content.length;
  }

  const highSignalSet = new Set(highSignalFiles);
  let totalBytes = 0;
  for (const s of scored) {
    totalBytes += s.file.sizeBytes;
    files.push({
      path: s.file.relativePath,
      language: detectLanguage(s.file.relativePath),
      lineCount: s.lineCount,
      sizeBytes: s.file.sizeBytes,
      isHighSignal: highSignalSet.has(s.file.relativePath),
      contentHash: highSignalSet.has(s.file.relativePath)
        ? contentHashOf([s.content])
        : undefined,
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  const contentHash = contentHashOf(
    highSignalFiles
      .slice()
      .sort()
      .map((p) => `${p}:${highSignalFileContents.get(p) ?? ''}`),
  );

  const manifest: CodebaseManifest = {
    codebaseId: options.codebaseId,
    createdAt: new Date().toISOString(),
    sourceType: options.sourceType,
    sourceRef: options.sourceRef,
    totalFiles: files.length,
    totalBytes,
    files,
    frameworks,
    highSignalFiles,
    contentHash,
  };

  return { manifest, highSignalFileContents };
}
