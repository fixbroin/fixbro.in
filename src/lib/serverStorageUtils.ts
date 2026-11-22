import fs from 'node:fs/promises';
import path from 'node:path';
import { executeDbGetDoc } from '@/app/actions/dbActions';

/**
 * Permanently deletes an array of file URLs or paths from both
 * local VPS disk (public/uploads, public/sounds) and remote storage CDN.
 */
export async function deleteStorageFiles(urls: (string | undefined | null)[]): Promise<void> {
  const validUrls = urls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  if (validUrls.length === 0) return;

  let remoteUploadUrl = process.env.REMOTE_UPLOAD_URL || '';
  let remoteSecretKey = process.env.REMOTE_SECRET_KEY || '';

  try {
    const storageDoc = await executeDbGetDoc('webSettings', 'storageConfiguration');
    if (storageDoc && storageDoc.exists && storageDoc.data) {
      if (storageDoc.data.remoteUploadUrl) remoteUploadUrl = storageDoc.data.remoteUploadUrl;
      if (storageDoc.data.remoteSecretKey) remoteSecretKey = storageDoc.data.remoteSecretKey;
    }
  } catch {
    // Continue with env defaults
  }

  for (const rawUrl of validUrls) {
    let fileUrl = rawUrl.trim();
    // Normalize full URLs (e.g. https://domain.com/uploads/... or http://domain.com/sounds/...)
    const uploadsMatch = fileUrl.match(/\/uploads\/.+/i);
    if (uploadsMatch) {
      fileUrl = uploadsMatch[0];
    } else {
      const soundsMatch = fileUrl.match(/\/sounds\/.+/i);
      if (soundsMatch) {
        fileUrl = soundsMatch[0];
      }
    }

    // 1. Delete from local server disk (public/uploads/)
    if (fileUrl.startsWith('/uploads/') || fileUrl.startsWith('uploads/')) {
      try {
        const cleanPath = path.normalize(fileUrl.replace(/^\/?uploads\//, '')).replace(/^(\.\.(\/|\\|$))+/, '');
        let baseDir = process.cwd();
        if (baseDir.includes(path.join('.next', 'standalone')) || baseDir.endsWith('standalone')) {
          baseDir = path.join(baseDir, '..', '..');
        }
        const targetDir = path.join(baseDir, 'public', 'uploads');
        const filePath = path.resolve(targetDir, cleanPath);

        if (filePath.startsWith(targetDir)) {
          await fs.unlink(filePath).catch(() => {});
        }
      } catch (localErr) {
        console.warn('Error deleting local storage file:', fileUrl, localErr);
      }
    } else if (fileUrl.startsWith('/sounds/') || fileUrl.startsWith('sounds/')) {
      try {
        const cleanPath = path.normalize(fileUrl.replace(/^\/?sounds\//, '')).replace(/^(\.\.(\/|\\|$))+/, '');
        let baseDir = process.cwd();
        if (baseDir.includes(path.join('.next', 'standalone')) || baseDir.endsWith('standalone')) {
          baseDir = path.join(baseDir, '..', '..');
        }
        const targetDir = path.join(baseDir, 'public', 'sounds');
        const filePath = path.resolve(targetDir, cleanPath);

        if (filePath.startsWith(targetDir)) {
          await fs.unlink(filePath).catch(() => {});
        }
      } catch (localErr) {
        console.warn('Error deleting local sound file:', fileUrl, localErr);
      }
    }

    // 2. Delete from remote storage server if configured
    if (remoteUploadUrl && remoteUploadUrl.trim() !== '') {
      try {
        const remoteFormData = new FormData();
        remoteFormData.append('action', 'delete');
        remoteFormData.append('fileUrl', fileUrl);

        await fetch(remoteUploadUrl.trim(), {
          method: 'POST',
          headers: {
            'x-api-secret': remoteSecretKey,
          },
          body: remoteFormData,
        }).catch(() => {});
      } catch (remoteErr) {
        console.warn('Error deleting remote storage file:', fileUrl, remoteErr);
      }
    }
  }
}
