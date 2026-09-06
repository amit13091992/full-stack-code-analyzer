import { useState } from 'react';
import type {
  CodebaseManifest,
  Finding,
  FindingsResponse,
  QueryTemplateId,
  UsageRecord,
} from '@code-analyzer/shared';
import UploadView from './components/UploadView.js';
import ArchitectureSummary from './components/ArchitectureSummary.js';
import QueryBuilder from './components/QueryBuilder.js';
import ResultCards from './components/ResultCards.js';
import SourceViewer from './components/SourceViewer.js';
import CostDashboard from './components/CostDashboard.js';
import { getFileContent, getUsage, runQuery, ApiClientError } from './lib/api-client.js';

interface Codebase {
  codebaseId: string;
  manifest: CodebaseManifest;
}

export default function App() {
  const [codebase, setCodebase] = useState<Codebase | null>(null);
  const [findings, setFindings] = useState<FindingsResponse | null>(null);
  const [usage, setUsage] = useState<UsageRecord | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [sourceContent, setSourceContent] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);

  async function handleQuery(query: string, template?: QueryTemplateId) {
    if (!codebase) return;
    setQuerying(true);
    setQueryError(null);
    try {
      const { result } = await runQuery(codebase.codebaseId, query, template);
      if ('findings' in result) {
        setFindings(result);
      }
      const usageRecord = await getUsage(codebase.codebaseId);
      setUsage(usageRecord);
    } catch (err) {
      setQueryError(err instanceof ApiClientError ? err.message : 'Query failed.');
    } finally {
      setQuerying(false);
    }
  }

  async function handleSelectFinding(finding: Finding) {
    if (!codebase) return;
    setSelectedFinding(finding);
    setSourceContent(null);
    try {
      const content = await getFileContent(codebase.codebaseId, finding.file_path);
      setSourceContent(content);
    } catch {
      setSourceContent(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-8 bg-slate-50 p-8">
      <h1 className="text-2xl font-bold text-slate-800">AI Code Analyzer</h1>

      {!codebase && (
        <UploadView onIngested={(result) => setCodebase(result)} />
      )}

      {codebase && (
        <>
          <ArchitectureSummary manifest={codebase.manifest} />
          <QueryBuilder onSubmit={handleQuery} submitting={querying} />
          {queryError && <p role="alert" className="text-red-600">{queryError}</p>}
          {findings && <ResultCards findings={findings} onSelectFinding={handleSelectFinding} />}
          {selectedFinding && sourceContent !== null && (
            <SourceViewer
              filePath={selectedFinding.file_path}
              lineStart={selectedFinding.line_start}
              lineEnd={selectedFinding.line_end}
              content={sourceContent}
            />
          )}
          {usage && <CostDashboard usage={usage} />}
        </>
      )}
    </main>
  );
}
