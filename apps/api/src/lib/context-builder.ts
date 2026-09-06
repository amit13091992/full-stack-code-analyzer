import type { CodebaseManifest } from '@code-analyzer/shared';
import { contentHashOf } from './manifest-builder.js';

const INSTRUCTION_PREAMBLE = `You are an expert code analysis assistant. You will be given a codebase manifest and the contents of its high-signal files. Use only the "submit_findings" or "submit_dependency_map" tool (as instructed per-query) to return your analysis — never respond in plain prose.`;

export interface ContextBlock {
  text: string;
  contentHash: string;
}

/**
 * Builds the deterministic leading context block. Byte-identical output for the same
 * manifest.contentHash is the core invariant that makes Anthropic prompt caching hit —
 * any change to field order, whitespace, or content here invalidates the cache for every
 * codebase, so this function must stay pure and stable across calls.
 */
export function buildContextBlock(
  manifest: CodebaseManifest,
  highSignalFileContents: Map<string, string>,
): ContextBlock {
  const frameworksLine = manifest.frameworks.map((f) => f.name).join(', ') || 'none detected';

  const fileSections = manifest.highSignalFiles
    .slice()
    .sort()
    .map((filePath) => {
      const content = highSignalFileContents.get(filePath) ?? '';
      return `--- FILE: ${filePath} ---\n${content}`;
    })
    .join('\n\n');

  const text = [
    INSTRUCTION_PREAMBLE,
    '',
    `Codebase ID: ${manifest.codebaseId}`,
    `Source: ${manifest.sourceType} (${manifest.sourceRef})`,
    `Total files: ${manifest.totalFiles}`,
    `Detected frameworks: ${frameworksLine}`,
    `High-signal files: ${manifest.highSignalFiles.slice().sort().join(', ') || 'none'}`,
    '',
    fileSections,
  ].join('\n');

  return { text, contentHash: contentHashOf([text]) };
}
