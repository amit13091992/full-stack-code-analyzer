import { useState } from 'react';
import { html as diff2html } from 'diff2html';
import type { Finding, FindingsResponse } from '@code-analyzer/shared';
import 'diff2html/bundles/css/diff2html.min.css';

export interface ResultCardsProps {
  findings: FindingsResponse;
  onSelectFinding?: (finding: Finding) => void;
}

const SEVERITY_STYLES: Record<Finding['severity'], string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  low: 'bg-sky-100 text-sky-800 border-sky-300',
  info: 'bg-slate-100 text-slate-800 border-slate-300',
};

function FindingCard({
  finding,
  onSelectFinding,
}: {
  finding: Finding;
  onSelectFinding?: (finding: Finding) => void;
}) {
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);

  return (
    <article
      className={`rounded border p-4 ${SEVERITY_STYLES[finding.severity]}`}
      data-testid="finding-card"
    >
      <header className="flex items-center justify-between">
        <h3 className="font-semibold">{finding.title}</h3>
        <span className="rounded-full border px-2 py-0.5 text-xs uppercase">
          {finding.severity}
        </span>
      </header>
      <p className="mt-1 text-sm">{finding.explanation}</p>
      <button
        type="button"
        onClick={() => onSelectFinding?.(finding)}
        className="mt-2 font-mono text-sm underline"
      >
        {finding.file_path}:{finding.line_start}-{finding.line_end}
      </button>

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setSnippetOpen((v) => !v)}
          aria-expanded={snippetOpen}
        >
          {snippetOpen ? 'Hide code snippet' : 'Show code snippet'}
        </button>
        {snippetOpen && (
          <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-2 text-xs text-slate-100">
            <code>{finding.code_snippet}</code>
          </pre>
        )}
      </div>

      {finding.suggested_fix && (
        <div className="mt-2">
          <button type="button" onClick={() => setDiffOpen((v) => !v)} aria-expanded={diffOpen}>
            {diffOpen ? 'Hide suggested fix' : 'Show suggested fix'}
          </button>
          {diffOpen && (
            <div>
              <p className="mt-1 text-sm">{finding.suggested_fix.description}</p>
              <div
                data-testid="diff-view"
                className="mt-1 overflow-x-auto text-xs"
                dangerouslySetInnerHTML={{
                  __html: diff2html(finding.suggested_fix.diff, {
                    drawFileList: false,
                    outputFormat: 'line-by-line',
                  }),
                }}
              />
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function ResultCards({ findings, onSelectFinding }: ResultCardsProps) {
  return (
    <section aria-label="Findings" className="space-y-4">
      <p className="text-sm text-slate-600">{findings.summary}</p>
      <div className="space-y-3">
        {findings.findings.map((f) => (
          <FindingCard key={f.id} finding={f} onSelectFinding={onSelectFinding} />
        ))}
      </div>
    </section>
  );
}
