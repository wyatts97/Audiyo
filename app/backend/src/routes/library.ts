import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import NodeID3 from 'node-id3';
import { tagFile } from '../tagger';
import { libraryCache } from '../libraryCache';
import { logger } from '../logger';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { paginationSchema, searchQuerySchema, trackUpdateSchema } from '../validation';
import { searchLimiter } from '../middleware/rateLimiter';
import { config } from '../config';
import { getSetting } from '../db';
import { API_CONSTANTS } from '../constants';

interface LibraryTrack {
  id: string;
  filename: string;
  title: string;
  artist: string;
  album: string;
  hasArtwork: boolean;
}

export const libraryRouter = Router();

function getLibraryDir() {
  const customPath = getSetting('libraryPath', '');
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }
  return config.libraryDir;
}

libraryRouter.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = paginationSchema.parse(req.query);
  const result = libraryCache.getTracks(page, limit);
  res.json({ ...result, page, limit });
}));

libraryRouter.get('/artwork/:id', asyncHandler(async (req: Request, res: Response) => {
  const libraryDir = getLibraryDir();
  const filename = Buffer.from(req.params.id, 'base64').toString('utf-8');
  const filePath = path.join(libraryDir, filename);

  if (!fs.existsSync(filePath)) {
    throw new AppError(404, 'Track not found');
  }

  const tags = NodeID3.read(filePath);
  
  if (tags.image && typeof tags.image === 'object' && 'imageBuffer' in tags.image) {
    const imageBuffer = tags.image.imageBuffer;
    const mime = tags.image.mime || 'image/jpeg';
    
    res.set('Content-Type', mime);
    res.set('Cache-Control', `public, max-age=${API_CONSTANTS.CACHE.ARTWORK_MAX_AGE}`);
    return res.send(imageBuffer);
  }

  throw new AppError(404, 'No artwork found');
}));

// Stream audio file for playback
libraryRouter.get('/stream/:id', (req: Request, res: Response) => {
  try {
    const libraryDir = getLibraryDir();
    const filename = Buffer.from(req.params.id, 'base64').toString('utf-8');
    const filePath = path.join(libraryDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Track not found' });
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.opus': 'audio/opus',
      '.flac': 'audio/flac',
      '.m4a': 'audio/mp4',
    };

    res.set({
      'Content-Type': mimeTypes[ext] || 'audio/mpeg',
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    });

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = end - start + 1;

      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': chunksize,
      });

      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Error streaming audio:', error);
    res.status(500).json({ message: 'Failed to stream audio' });
  }
});

// Get single track details
libraryRouter.get('/track/:id', (req: Request, res: Response) => {
  try {
    const libraryDir = getLibraryDir();
    const filename = Buffer.from(req.params.id, 'base64').toString('utf-8');
    const filePath = path.join(libraryDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Track not found' });
    }

    const stat = fs.statSync(filePath);
    const tags = NodeID3.read(filePath);

    res.json({
      id: req.params.id,
      filename,
      title: tags.title || path.basename(filename, path.extname(filename)),
      artist: tags.artist || 'Unknown Artist',
      album: tags.album || 'Unknown Album',
      genre: tags.genre || '',
      year: tags.year || '',
      hasArtwork: !!tags.image,
      fileSize: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching track:', error);
    res.status(500).json({ message: 'Failed to fetch track' });
  }
});

// Search library
libraryRouter.get('/search', (req: Request, res: Response) => {
  try {
    const libraryDir = getLibraryDir();
    const query = (req.query.q as string || '').toLowerCase();
    
    if (!query) {
      return res.json({ tracks: [] });
    }

    if (!fs.existsSync(libraryDir)) {
      return res.json({ tracks: [] });
    }

    const allFiles = fs.readdirSync(libraryDir)
      .filter(f => ['.mp3', '.opus', '.flac', '.m4a'].some(ext => f.endsWith(ext)));

    const tracks: LibraryTrack[] = [];

    for (const filename of allFiles) {
      const filePath = path.join(libraryDir, filename);
      const id = Buffer.from(filename).toString('base64');

      try {
        const tags = NodeID3.read(filePath);
        const title = tags.title || path.basename(filename, path.extname(filename));
        const artist = tags.artist || 'Unknown Artist';
        const album = tags.album || 'Unknown Album';

        if (title.toLowerCase().includes(query) ||
            artist.toLowerCase().includes(query) ||
            album.toLowerCase().includes(query)) {
          tracks.push({
            id,
            filename,
            title,
            artist,
            album,
            hasArtwork: !!tags.image,
          });
        }
      } catch (e) {
        if (filename.toLowerCase().includes(query)) {
          tracks.push({
            id,
            filename,
            title: path.basename(filename, path.extname(filename)),
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            hasArtwork: false,
          });
        }
      }

      if (tracks.length >= 50) break;
    }

    res.json({ tracks });
  } catch (error) {
    console.error('Error searching library:', error);
    res.status(500).json({ message: 'Failed to search library' });
  }
});

// Delete track
libraryRouter.delete('/track/:id', (req: Request, res: Response) => {
  try {
    const libraryDir = getLibraryDir();
    const filename = Buffer.from(req.params.id, 'base64').toString('utf-8');
    const filePath = path.join(libraryDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Track not found' });
    }

    fs.unlinkSync(filePath);
    res.json({ message: 'Track deleted' });
  } catch (error) {
    console.error('Error deleting track:', error);
    res.status(500).json({ message: 'Failed to delete track' });
  }
});

// Update track metadata
libraryRouter.put('/track/:id', async (req: Request, res: Response) => {
  try {
    const libraryDir = getLibraryDir();
    const filename = Buffer.from(req.params.id, 'base64').toString('utf-8');
    const filePath = path.join(libraryDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Track not found' });
    }

    const { title, artist, album, genre, year } = req.body;

    const existingTags = NodeID3.read(filePath);
    
    const newTags: NodeID3.Tags = {
      title: title || existingTags.title,
      artist: artist || existingTags.artist,
      album: album || existingTags.album,
      genre: genre !== undefined ? genre : existingTags.genre,
      year: year !== undefined ? year : existingTags.year,
    };

    if (existingTags.image) {
      newTags.image = existingTags.image;
    }

    const success = NodeID3.write(newTags, filePath);

    if (!success) {
      return res.status(500).json({ message: 'Failed to update metadata' });
    }

    // Rename file if title or artist changed
    if (title || artist) {
      const ext = path.extname(filename);
      const newArtist = (artist || existingTags.artist || '').replace(/[<>:"/\\|?*]/g, '').trim();
      const newTitle = (title || existingTags.title || '').replace(/[<>:"/\\|?*]/g, '').trim();
      const newFilename = newArtist ? `${newArtist} - ${newTitle}${ext}` : `${newTitle}${ext}`;
      const newPath = path.join(libraryDir, newFilename);

      if (newPath !== filePath && !fs.existsSync(newPath)) {
        fs.renameSync(filePath, newPath);
        return res.json({
          message: 'Track updated',
          id: Buffer.from(newFilename).toString('base64'),
          filename: newFilename,
        });
      }
    }

    res.json({ message: 'Track updated', id: req.params.id, filename });
  } catch (error) {
    console.error('Error updating track:', error);
    res.status(500).json({ message: 'Failed to update track' });
  }
});

// Download track
libraryRouter.get('/download/:id', (req: Request, res: Response) => {
  try {
    const libraryDir = getLibraryDir();
    const filename = Buffer.from(req.params.id, 'base64').toString('utf-8');
    const filePath = path.join(libraryDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Track not found' });
    }

    res.download(filePath, filename);
  } catch (error) {
    console.error('Error downloading track:', error);
    res.status(500).json({ message: 'Failed to download track' });
  }
});
