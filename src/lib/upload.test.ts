import { describe, expect, it } from 'vitest';
import { checkUpload, MAX_UPLOAD_BYTES, sniffMimeType } from './upload';

const PDF = new TextEncoder().encode('%PDF-1.7\n...');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]);
const TEXT = new TextEncoder().encode('hello, this is not an invoice');

describe('upload validation', () => {
  it('detects PDF, PNG and JPEG from their bytes', () => {
    expect(sniffMimeType(PDF)).toBe('application/pdf');
    expect(sniffMimeType(PNG)).toBe('image/png');
    expect(sniffMimeType(JPEG)).toBe('image/jpeg');
    expect(sniffMimeType(TEXT)).toBeNull();
  });

  it('accepts a supported file up to 4 MB', () => {
    expect(checkUpload(MAX_UPLOAD_BYTES, PDF)).toEqual({ ok: true, mimeType: 'application/pdf' });
  });

  it('rejects files over 4 MB with 413', () => {
    expect(checkUpload(MAX_UPLOAD_BYTES + 1, PDF)).toMatchObject({ ok: false, status: 413 });
  });

  it('rejects other types and empty files with 400', () => {
    expect(checkUpload(TEXT.length, TEXT)).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/PDF, PNG or JPEG/) });
    expect(checkUpload(0, new Uint8Array())).toMatchObject({ ok: false, status: 400 });
  });
});
