import { zodToJsonSchema } from 'zod-to-json-schema';
import { FindingsResponseSchema } from './findings.js';
import { DependencyMapResponseSchema } from './dependency-map.js';

/**
 * Single schema definition (the Zod schemas above), two consumers: these JSON Schemas are
 * used both as Anthropic tool-use `input_schema` and for ajv validation of the tool response,
 * so the two can never drift apart.
 */
export const FindingsResponseJsonSchema = zodToJsonSchema(FindingsResponseSchema, {
  name: 'FindingsResponse',
  target: 'jsonSchema7',
});

export const DependencyMapResponseJsonSchema = zodToJsonSchema(DependencyMapResponseSchema, {
  name: 'DependencyMapResponse',
  target: 'jsonSchema7',
});
