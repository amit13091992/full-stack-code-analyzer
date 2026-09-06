import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ResultCards from './ResultCards.js';
import { fixtureFindingsResponse } from '../fixtures/index.js';

describe('ResultCards', () => {
  it('renders one severity-colored card per finding', () => {
    render(<ResultCards findings={fixtureFindingsResponse} />);
    const cards = screen.getAllByTestId('finding-card');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText(/critical/i)).toBeInTheDocument();
    expect(within(cards[1]!).getByText(/low/i)).toBeInTheDocument();
  });

  it('toggles the collapsible code snippet', () => {
    render(<ResultCards findings={fixtureFindingsResponse} />);
    const card = screen.getAllByTestId('finding-card')[0]!;
    expect(within(card).queryByText(/sk-12345/)).not.toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: /show code snippet/i }));
    expect(within(card).getByText(/sk-12345/)).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: /hide code snippet/i }));
    expect(within(card).queryByText(/sk-12345/)).not.toBeInTheDocument();
  });

  it('toggles the collapsible unified-diff view rendered from a fixture diff string', () => {
    render(<ResultCards findings={fixtureFindingsResponse} />);
    const card = screen.getAllByTestId('finding-card')[0]!;

    expect(within(card).queryByTestId('diff-view')).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: /show suggested fix/i }));

    const diffView = within(card).getByTestId('diff-view');
    expect(diffView).toBeInTheDocument();
    expect(diffView.querySelector('.d2h-file-wrapper')).toBeTruthy();
    expect(diffView.textContent).toContain('process.env.API_KEY');
  });

  it('calls onSelectFinding with the finding when the file/line link is clicked', () => {
    const onSelectFinding = vi.fn();
    render(<ResultCards findings={fixtureFindingsResponse} onSelectFinding={onSelectFinding} />);

    fireEvent.click(screen.getByRole('button', { name: /src\/routes\/auth\.ts:4-6/ }));
    expect(onSelectFinding).toHaveBeenCalledWith(fixtureFindingsResponse.findings[0]);
  });
});
