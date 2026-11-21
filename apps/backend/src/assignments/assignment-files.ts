import * as fs from 'fs';
import * as path from 'path';

/**
 * Assignment documents (teacher instructions and student hand-ins) are kept
 * OUTSIDE the public `/uploads` static folder, so they can only be read through
 * the authenticated download routes of AssignmentsController.
 */
export const PRIVATE_ASSIGNMENT_DIR = 'storage/assignments';

/** Files stored before this change still live in the public folder. */
const LEGACY_DIR = 'uploads';

/** Largest document a teacher or a student may attach. */
export const MAX_ASSIGNMENT_FILE_BYTES = 20 * 1024 * 1024;

const uniqueSuffix = () => `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

export function ensurePrivateDir() {
  fs.mkdirSync(path.join(process.cwd(), PRIVATE_ASSIGNMENT_DIR), {
    recursive: true,
  });
}

/** Keeps only the file name and drops characters that are unsafe on disk. */
export function safeOriginalName(name: string | undefined) {
  const base = path.basename(String(name ?? '').replace(/\\/g, '/'));
  const cleaned = base.replace(/[^\p{L}\p{N}._\- ]+/gu, '_').trim();
  return cleaned || 'file';
}

/** Multer hands UTF-8 file names over as latin1 ("Ã©lÃ¨ve.pdf"); undo that. */
export function decodeUploadName(name: string) {
  // already decoded: holds characters latin1 cannot represent
  if (/[^\x00-\xff]/.test(name)) return name;
  const utf8 = Buffer.from(name, 'latin1').toString('utf8');
  // U+FFFD means the bytes were not UTF-8: keep the name as it came
  return utf8.includes(String.fromCharCode(0xfffd)) ? name : utf8;
}

export function storedFileName(
  prefix: 'task' | 'submission',
  originalName: string,
) {
  return `${prefix}-${uniqueSuffix()}-${safeOriginalName(decodeUploadName(originalName))}`;
}

/** Value saved in the database for a file multer just wrote. */
export function storedPath(filename: string) {
  return `${PRIVATE_ASSIGNMENT_DIR}/${filename}`;
}

/** Name shown to users: the stored name without the generated prefix. */
export function displayName(filePath: string | null | undefined) {
  if (!filePath) return null;
  const base = path.basename(filePath);
  return base.replace(/^(?:task-|submission-)?\d+-\d+-/, '');
}

/**
 * Absolute path of a stored file, or null when the value points outside the
 * allowed folders (path traversal) or the file is gone.
 */
export function resolveStoredFile(filePath: string | null | undefined) {
  if (!filePath) return null;
  const root = process.cwd();
  const absolute = path.resolve(root, filePath);
  const allowed = [PRIVATE_ASSIGNMENT_DIR, LEGACY_DIR].map(
    (dir) => path.resolve(root, dir) + path.sep,
  );
  if (!allowed.some((dir) => absolute.startsWith(dir))) return null;
  return fs.existsSync(absolute) ? absolute : null;
}

/** Best-effort removal (replaced hand-in, deleted assignment, failed request). */
export function removeStoredFile(filePath: string | null | undefined) {
  const absolute = resolveStoredFile(filePath);
  if (!absolute) return;
  try {
    fs.unlinkSync(absolute);
  } catch {
    // a file we cannot remove must never break the request
  }
}
