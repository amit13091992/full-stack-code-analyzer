import { useState } from 'react';
import { QUERY_TEMPLATES, type QueryTemplateId } from '@code-analyzer/shared';

export interface QueryBuilderProps {
  onSubmit: (query: string, template?: QueryTemplateId) => void;
  submitting?: boolean;
}

export default function QueryBuilder({ onSubmit, submitting }: QueryBuilderProps) {
  const [text, setText] = useState('');
  const [template, setTemplate] = useState<QueryTemplateId | undefined>(undefined);

  function selectTemplate(id: QueryTemplateId) {
    setTemplate(id);
    setText(QUERY_TEMPLATES[id].prefilledQuery);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim(), template);
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Query builder" className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {Object.values(QUERY_TEMPLATES).map((def) => (
          <button
            key={def.id}
            type="button"
            onClick={() => selectTemplate(def.id)}
            aria-pressed={template === def.id}
            className={`rounded px-3 py-1 text-sm ${
              template === def.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'
            }`}
          >
            {def.label}
          </button>
        ))}
      </div>

      <label htmlFor="query-text" className="sr-only">
        Query
      </label>
      <textarea
        id="query-text"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setTemplate(undefined);
        }}
        placeholder="Ask a question about this codebase…"
        className="w-full rounded border border-slate-300 p-2"
        rows={3}
      />

      <button
        type="submit"
        disabled={submitting || !text.trim()}
        className="rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
      >
        {submitting ? 'Running…' : 'Run query'}
      </button>
    </form>
  );
}
