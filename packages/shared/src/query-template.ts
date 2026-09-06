import { z } from 'zod';

export const QueryTemplateIdSchema = z.enum([
  'security-audit',
  'n-plus-one-performance',
  'typescript-safety',
  'dependency-map',
  'code-smell-tech-debt',
]);
export type QueryTemplateId = z.infer<typeof QueryTemplateIdSchema>;

export type QueryTemplateOutputSchema = 'FindingsResponse' | 'DependencyMapResponse';

export interface QueryTemplateDefinition {
  id: QueryTemplateId;
  label: string;
  prefilledQuery: string;
  promptFragment: string;
  outputSchema: QueryTemplateOutputSchema;
}

export const QUERY_TEMPLATES: Record<QueryTemplateId, QueryTemplateDefinition> = {
  'security-audit': {
    id: 'security-audit',
    label: 'Security audit',
    prefilledQuery:
      'Perform a security audit of authentication flows, injection risks, secret handling, and insecure deserialization.',
    promptFragment:
      'Focus on security vulnerabilities: auth flows, injection (SQL/NoSQL/command), hardcoded secrets, insecure deserialization, and unsafe input handling. Categorize every finding as "security" unless clearly out of scope.',
    outputSchema: 'FindingsResponse',
  },
  'n-plus-one-performance': {
    id: 'n-plus-one-performance',
    label: 'N+1 / performance patterns',
    prefilledQuery: 'Identify N+1 query patterns and other performance bottlenecks.',
    promptFragment:
      'Focus on performance: N+1 database query patterns, unnecessary re-computation, unbounded loops over remote calls, missing caching/batching opportunities. Categorize findings as "performance".',
    outputSchema: 'FindingsResponse',
  },
  'typescript-safety': {
    id: 'typescript-safety',
    label: 'TypeScript / type-safety improvements',
    prefilledQuery: 'Suggest TypeScript type-safety improvements.',
    promptFragment:
      'Focus on type safety: any usage, unsafe casts, missing null checks, weak generic bounds, unchecked external input. Categorize findings as "types".',
    outputSchema: 'FindingsResponse',
  },
  'dependency-map': {
    id: 'dependency-map',
    label: 'Dependency & module map',
    prefilledQuery: 'Map the dependencies and module relationships in this codebase.',
    promptFragment:
      'Produce a dependency/module map: key modules, packages, and services as nodes, and their import/call/dependency relationships as edges.',
    outputSchema: 'DependencyMapResponse',
  },
  'code-smell-tech-debt': {
    id: 'code-smell-tech-debt',
    label: 'Code smell / tech debt scan',
    prefilledQuery: 'Scan for general code smells and technical debt.',
    promptFragment:
      'Focus on general code smells and technical debt: duplication, overly complex functions, poor separation of concerns, dead code, inconsistent patterns. Categorize findings as "maintainability" or "architecture" as appropriate.',
    outputSchema: 'FindingsResponse',
  },
};
