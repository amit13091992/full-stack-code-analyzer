import { z } from 'zod';

export const DependencyNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  file_path: z.string().min(1),
  kind: z.enum(['module', 'package', 'service']),
});
export type DependencyNode = z.infer<typeof DependencyNodeSchema>;

export const DependencyEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  relationship: z.enum(['imports', 'calls', 'depends_on']),
});
export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>;

export const DependencyMapResponseSchema = z.object({
  summary: z.string().min(1),
  nodes: z.array(DependencyNodeSchema),
  edges: z.array(DependencyEdgeSchema),
});
export type DependencyMapResponse = z.infer<typeof DependencyMapResponseSchema>;
