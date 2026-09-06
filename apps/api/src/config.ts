export const config = {
  port: Number(process.env.PORT ?? 3001),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024),
  maxUploadFiles: Number(process.env.MAX_UPLOAD_FILES ?? 2000),
  highSignalTokenBudget: Number(process.env.HIGH_SIGNAL_TOKEN_BUDGET ?? 60_000),
  dbPath: process.env.DB_PATH ?? ':memory:',
  llmMock: process.env.LLM_MOCK === '1',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5-20250929',
};
