import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SourceViewer from './SourceViewer.js';
import { fixtureSourceExcerpt } from '../fixtures/index.js';

describe('SourceViewer', () => {
  it('renders the source excerpt with the flagged lines highlighted', () => {
    render(
      <SourceViewer
        filePath={fixtureSourceExcerpt.path}
        lineStart={3}
        lineEnd={6}
        content={fixtureSourceExcerpt.content}
      />,
    );

    expect(screen.getByText(fixtureSourceExcerpt.path)).toBeInTheDocument();

    expect(screen.getByTestId('source-line-3')).toHaveAttribute('data-flagged', 'true');
    expect(screen.getByTestId('source-line-6')).toHaveAttribute('data-flagged', 'true');
    expect(screen.getByTestId('source-line-1')).toHaveAttribute('data-flagged', 'false');
    expect(screen.getByTestId('source-line-8')).toHaveAttribute('data-flagged', 'false');

    expect(screen.getByTestId('source-line-3').className).toContain('bg-yellow-200');
    expect(screen.getByTestId('source-line-1').className).toBe('');
  });
});
