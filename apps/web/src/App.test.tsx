import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.js';

describe('App', () => {
  it('renders the heading and starts on the upload view', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /AI Code Analyzer/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/upload codebase/i)).toBeInTheDocument();
  });
});
