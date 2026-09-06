import { z } from 'zod';

export const SeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof SeveritySchema>;

export const CategorySchema = z.enum([
  'security',
  'performance',
  'types',
  'architecture',
  'maintainability',
]);
export type Category = z.infer<typeof CategorySchema>;

export const SuggestedFixSchema = z.object({
  description: z.string().min(1),
  diff: z.string().min(1),
});
export type SuggestedFix = z.infer<typeof SuggestedFixSchema>;

export const FindingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: CategorySchema,
  severity: SeveritySchema,
  explanation: z.string().min(1),
  file_path: z.string().min(1),
  line_start: z.number().int().nonnegative(),
  line_end: z.number().int().nonnegative(),
  code_snippet: z.string(),
  suggested_fix: SuggestedFixSchema.optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const FindingsResponseSchema = z.object({
  summary: z.string().min(1),
  findings: z.array(FindingSchema),
});
export type FindingsResponse = z.infer<typeof FindingsResponseSchema>;
