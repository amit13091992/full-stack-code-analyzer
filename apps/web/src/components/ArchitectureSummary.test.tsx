import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArchitectureSummary from './ArchitectureSummary.js';
import { fixtureManifest } from '../fixtures/index.js';

describe('ArchitectureSummary', () => {
  it('renders the file tree, frameworks, and high-signal files from the manifest', () => {
    render(<ArchitectureSummary manifest={fixtureManifest} />);

    expect(screen.getByText(/3 files/)).toBeInTheDocument();
    expect(screen.getByText(/express \(4\.0\.0\)/)).toBeInTheDocument();

    for (const file of fixtureManifest.files) {
      expect(screen.getAllByText(file.path).length).toBeGreaterThan(0);
    }
    for (const highSignal of fixtureManifest.highSignalFiles) {
      expect(screen.getAllByText(highSignal).length).toBeGreaterThan(0);
    }
  });

  it('shows a fallback message when no frameworks are detected', () => {
    render(<ArchitectureSummary manifest={{ ...fixtureManifest, frameworks: [] }} />);
    expect(screen.getByText(/none detected/i)).toBeInTheDocument();
  });
});
