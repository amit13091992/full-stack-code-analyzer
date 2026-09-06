import type { CodebaseManifest } from '@code-analyzer/shared';

export interface ArchitectureSummaryProps {
  manifest: CodebaseManifest;
}

export default function ArchitectureSummary({ manifest }: ArchitectureSummaryProps) {
  return (
    <section aria-label="Architecture summary" className="space-y-4">
      <h2 className="text-lg font-semibold">Architecture summary</h2>
      <p className="text-sm text-slate-600">
        {manifest.totalFiles} files &middot; {manifest.totalBytes} bytes &middot; source:{' '}
        {manifest.sourceRef}
      </p>

      <div>
        <h3 className="font-medium">Detected frameworks</h3>
        {manifest.frameworks.length === 0 ? (
          <p className="text-sm text-slate-500">None detected.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {manifest.frameworks.map((fw) => (
              <li
                key={fw.name}
                className="rounded bg-slate-100 px-2 py-1 text-sm"
              >
                {fw.name}
                {fw.version ? ` (${fw.version})` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="font-medium">High-signal files</h3>
        <ul>
          {manifest.highSignalFiles.map((f) => (
            <li key={f} className="font-mono text-sm">
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-medium">File tree</h3>
        <ul>
          {manifest.files.map((f) => (
            <li key={f.path} className="font-mono text-sm text-slate-700">
              {f.path}{' '}
              <span className="text-slate-400">
                ({f.language}, {f.lineCount} lines)
              </span>
              {f.isHighSignal && (
                <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800">
                  high-signal
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
