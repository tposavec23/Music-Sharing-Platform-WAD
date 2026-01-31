import fs from 'fs';
import { Router, Request, Response } from 'express';
import formidable, { File } from 'formidable';

import { requireAuth } from './auth';

export const uploadRouter = Router();

const uploadDir = process.env.UPLOADSDIR || './uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function sanitizeFilename(name: string): string {
  if (typeof name !== 'string') return '';

  const match = name.match(/^(.*?)(\.[^.]+)?$/);
  if (!match) return '';

  const base = match[1]
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  const ext = match[2] || '';

  return base + ext;
}

// Upload file
uploadRouter.post('/', requireAuth(), async (req: Request, res: Response) => {
  const form = formidable({
    uploadDir,
    keepExtensions: true,
    multiples: false,
    maxFileSize: 5 * 1024 * 1024, // 5MB limit
  });

  form.parse(req, (err: Error | null, fields: formidable.Fields, files: formidable.Files) => {
    if (err) {
      console.error('Error while parsing form:', err);
      return res.status(400).json({ error: 'File upload failed' });
    }

    const uploadedFile = (files.file as File | File[]) || null;
    const uploadSubfolder = sanitizeFilename((fields.path?.[0] as string) || '');
    const name = sanitizeFilename((fields.name?.[0] as string) || '');
    const file = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;

    const targetDir = uploadSubfolder ? `${uploadDir}/${uploadSubfolder}` : uploadDir;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const backendPath = uploadSubfolder ? `${uploadDir}/${uploadSubfolder}/${name}` : `${uploadDir}/${name}`;

    if (!file) {
      if (deleteUploadedFile(name, uploadSubfolder)) {
        return res.json({ message: 'File deleted', filename: backendPath });
      }
      return res.status(400).json({ error: 'No file provided' });
    }

    const fileInfo = {
      originalFilename: file.originalFilename,
      savedAs: backendPath,
      size: file.size,
      mimeType: file.mimetype,
    };

    fs.renameSync(file.filepath, fileInfo.savedAs);

    return res.json({
      message: 'File uploaded successfully',
      file: fileInfo,
    });
  });
});

export function deleteUploadedFile(name: string, folder: string = ''): boolean {
  const backendPath = folder
    ? `${uploadDir}/${sanitizeFilename(folder)}/${sanitizeFilename(name)}`
    : `${uploadDir}/${sanitizeFilename(name)}`;

  if (fs.existsSync(backendPath)) {
    fs.unlinkSync(backendPath);
    return true;
  }
  return false;
}
