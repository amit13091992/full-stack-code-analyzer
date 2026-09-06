import { z } from 'zod';

export const ManifestFileSchema = z.object({
  path: z.string().min(1),
  language: z.string().min(1),
  lineCount: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  isHighSignal: z.boolean(),
  contentHash: z.string().min(1).optional(),
});
export type ManifestFile = z.infer<typeof ManifestFileSchema>;

export const DetectedFrameworkSchema = z.object({
  name: z.string().min(1),
  source: z.enum(['package.json', 'requirements.txt']),
  version: z.string().optional(),
});
export type DetectedFramework = z.infer<typeof DetectedFrameworkSchema>;

export const CodebaseManifestSchema = z.object({
  codebaseId: z.string().min(1),
  createdAt: z.string().datetime(),
  sourceType: z.enum(['zip', 'github']),
  sourceRef: z.string().min(1),
  totalFiles: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  files: z.array(ManifestFileSchema),
  frameworks: z.array(DetectedFrameworkSchema),
  highSignalFiles: z.array(z.string()),
  contentHash: z.string().min(1),
});
export type CodebaseManifest = z.infer<typeof CodebaseManifestSchema>;
