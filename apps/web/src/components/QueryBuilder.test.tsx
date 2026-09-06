import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QueryBuilder from './QueryBuilder.js';
import { QUERY_TEMPLATES } from '@code-analyzer/shared';

describe('QueryBuilder', () => {
  it('submits free text with no template tag', () => {
    const onSubmit = vi.fn();
    render(<QueryBuilder onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'find bugs' } });
    fireEvent.click(screen.getByRole('button', { name: /run query/i }));

    expect(onSubmit).toHaveBeenCalledWith('find bugs', undefined);
  });

  it.each(Object.values(QUERY_TEMPLATES))(
    'selecting the "$label" template pre-fills text and tags the request',
    (def) => {
      const onSubmit = vi.fn();
      render(<QueryBuilder onSubmit={onSubmit} />);

      fireEvent.click(screen.getByRole('button', { name: def.label }));
      expect(screen.getByRole('textbox')).toHaveValue(def.prefilledQuery);

      fireEvent.click(screen.getByRole('button', { name: /run query/i }));
      expect(onSubmit).toHaveBeenCalledWith(def.prefilledQuery, def.id);
    },
  );

  it('clears the template tag once the user edits the pre-filled text', () => {
    const onSubmit = vi.fn();
    render(<QueryBuilder onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Security audit' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'edited query text' } });
    fireEvent.click(screen.getByRole('button', { name: /run query/i }));

    expect(onSubmit).toHaveBeenCalledWith('edited query text', undefined);
  });
});
