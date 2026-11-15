/** Invoice uploads: PDF, PNG or JPEG, up to 4 MB (Vercel caps request bodies at 4.5 MB). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const;
export type UploadMimeType = (typeof ALLOWED_UPLOAD_TYPES)[number];

/** The real type from the file's first bytes, so a renamed file can't pass as a PDF. */
export function sniffMimeType(bytes: Uint8Array): UploadMimeType | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  return null;
}

export type UploadCheck =
  | { ok: true; mimeType: UploadMimeType }
  | { ok: false; status: 400 | 413; error: string };

const TOO_LARGE = 'This file is over 4 MB. Upload a smaller PDF, PNG or JPEG.';

export function checkUpload(size: number, bytes: Uint8Array): UploadCheck {
  if (size > MAX_UPLOAD_BYTES) return { ok: false, status: 413, error: TOO_LARGE };
  if (size === 0) return { ok: false, status: 400, error: 'This file is empty.' };
  const mimeType = sniffMimeType(bytes);
  if (!mimeType) return { ok: false, status: 400, error: 'Only PDF, PNG or JPEG invoices are supported.' };
  return { ok: true, mimeType };
}

/** Reject an oversized body from its Content-Length before reading it (form overhead allowed). */
export function bodyTooLarge(req: Request): Response | null {
  const length = Number(req.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_UPLOAD_BYTES + 64 * 1024) {
    return Response.json({ error: TOO_LARGE }, { status: 413 });
  }
  return null;
}
