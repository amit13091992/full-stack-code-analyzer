export interface SourceViewerProps {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  content: string;
}

export default function SourceViewer({ filePath, lineStart, lineEnd, content }: SourceViewerProps) {
  const lines = content.split('\n');

  return (
    <section aria-label="Source viewer" className="rounded border border-slate-300">
      <header className="border-b border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm">
        {filePath}
      </header>
      <pre className="overflow-x-auto p-2 text-xs">
        {lines.map((line, idx) => {
          const lineNumber = idx + 1;
          const flagged = lineNumber >= lineStart && lineNumber <= lineEnd;
          return (
            <div
              key={lineNumber}
              data-testid={`source-line-${lineNumber}`}
              data-flagged={flagged}
              className={flagged ? 'bg-yellow-200' : undefined}
            >
              <span className="mr-3 select-none text-slate-400">{lineNumber}</span>
              <code>{line}</code>
            </div>
          );
        })}
      </pre>
    </section>
  );
}
