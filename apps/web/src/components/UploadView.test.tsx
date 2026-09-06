import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UploadView from './UploadView.js';
import { fixtureManifest } from '../fixtures/index.js';
import * as apiClient from '../lib/api-client.js';

describe('UploadView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits a GitHub URL and reports the ingested codebase', async () => {
    const onIngested = vi.fn();
    vi.spyOn(apiClient, 'uploadGithubUrl').mockResolvedValue({
      codebaseId: 'cb_1',
      manifest: fixtureManifest,
    });

    render(<UploadView onIngested={onIngested} />);

    fireEvent.change(screen.getByLabelText(/github repository url/i), {
      target: { value: 'https://github.com/example/repo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /clone/i }));

    expect(screen.getByRole('status')).toHaveTextContent(/ingesting/i);

    await waitFor(() =>
      expect(onIngested).toHaveBeenCalledWith({ codebaseId: 'cb_1', manifest: fixtureManifest }),
    );
    expect(apiClient.uploadGithubUrl).toHaveBeenCalledWith('https://github.com/example/repo');
  });

  it('uploads a dropped ZIP file', async () => {
    const onIngested = vi.fn();
    vi.spyOn(apiClient, 'uploadZip').mockResolvedValue({
      codebaseId: 'cb_2',
      manifest: fixtureManifest,
    });

    render(<UploadView onIngested={onIngested} />);
    const dropzone = screen.getByLabelText(/zip dropzone/i);
    const file = new File(['zip-bytes'], 'repo.zip', { type: 'application/zip' });

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(onIngested).toHaveBeenCalled());
    expect(apiClient.uploadZip).toHaveBeenCalledWith(file);
  });

  it('shows an error state for a non-zip file without calling the API', async () => {
    const onIngested = vi.fn();
    const uploadSpy = vi.spyOn(apiClient, 'uploadZip');

    render(<UploadView onIngested={onIngested} />);
    const dropzone = screen.getByLabelText(/zip dropzone/i);
    const file = new File(['not a zip'], 'notes.txt', { type: 'text/plain' });

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid file type/i);
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(onIngested).not.toHaveBeenCalled();
  });

  it('shows an error state when the upload is over the size cap', async () => {
    const onIngested = vi.fn();
    vi.spyOn(apiClient, 'uploadZip').mockRejectedValue(
      new apiClient.ApiClientError('Upload exceeds the maximum size of 50MB', 413),
    );

    render(<UploadView onIngested={onIngested} />);
    const dropzone = screen.getByLabelText(/zip dropzone/i);
    const file = new File(['zip-bytes'], 'huge.zip', { type: 'application/zip' });

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(/exceeds the maximum size/i);
    expect(onIngested).not.toHaveBeenCalled();
  });

  it('shows an error state when the git clone fails', async () => {
    const onIngested = vi.fn();
    vi.spyOn(apiClient, 'uploadGithubUrl').mockRejectedValue(
      new apiClient.ApiClientError('Failed to clone repository: not found', 400),
    );

    render(<UploadView onIngested={onIngested} />);
    fireEvent.change(screen.getByLabelText(/github repository url/i), {
      target: { value: 'https://github.com/example/does-not-exist' },
    });
    fireEvent.click(screen.getByRole('button', { name: /clone/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to clone repository/i);
    expect(onIngested).not.toHaveBeenCalled();
  });
});
