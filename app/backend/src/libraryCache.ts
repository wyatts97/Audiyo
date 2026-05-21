import * as fs from 'fs';
import * as path from 'path';
import chokidar, { FSWatcher } from 'chokidar';
import NodeID3 from 'node-id3';
import { logger } from './logger';
import { AUDIO_FORMATS } from './constants';

export interface CachedTrack {
  id: string;
  filename: string;
  title: string;
  artist: string;
  album: string;
  genre?: string;
  year?: string;
  hasArtwork: boolean;
  platform?: 'youtube' | 'soundcloud';
  sourceUrl?: string;
  mtime: number;
}

class LibraryCache {
  private cache: Map<string, CachedTrack> = new Map();
  private watcher: FSWatcher | null = null;
  private libraryDir: string = '';
  private isInitialized = false;

  initialize(libraryDir: string): void {
    if (this.isInitialized && this.libraryDir === libraryDir) {
      return;
    }

    this.cleanup();
    this.libraryDir = libraryDir;

    if (!fs.existsSync(libraryDir)) {
      fs.mkdirSync(libraryDir, { recursive: true });
      logger.info('Created library directory', 'LibraryCache', { libraryDir });
    }

    this.scanLibrary();
    this.startWatcher();
    this.isInitialized = true;
  }

  private scanLibrary(): void {
    logger.info('Scanning library...', 'LibraryCache');
    const startTime = Date.now();

    try {
      const files = fs.readdirSync(this.libraryDir)
        .filter(f => AUDIO_FORMATS.EXTENSIONS.some(ext => f.endsWith(ext)));

      files.forEach(filename => {
        this.addToCache(filename);
      });

      const duration = Date.now() - startTime;
      logger.info(`Library scan complete: ${files.length} tracks in ${duration}ms`, 'LibraryCache');
    } catch (error) {
      logger.error('Failed to scan library', 'LibraryCache', { error });
    }
  }

  private addToCache(filename: string): void {
    try {
      const filePath = path.join(this.libraryDir, filename);
      const stat = fs.statSync(filePath);
      const id = Buffer.from(filename).toString('base64');

      const tags = NodeID3.read(filePath);
      
      let platform: 'youtube' | 'soundcloud' | undefined;
      let sourceUrl: string | undefined;
      
      if (tags.comment && typeof tags.comment === 'object' && 'text' in tags.comment) {
        const comment = tags.comment.text;
        if (comment?.includes('http')) {
          sourceUrl = comment;
          if (comment.includes('soundcloud')) platform = 'soundcloud';
          else if (comment.includes('youtube') || comment.includes('youtu.be')) platform = 'youtube';
        } else {
          if (comment?.includes('soundcloud')) platform = 'soundcloud';
          else if (comment?.includes('youtube')) platform = 'youtube';
        }
      }

      const track: CachedTrack = {
        id,
        filename,
        title: tags.title || path.basename(filename, path.extname(filename)),
        artist: tags.artist || 'Unknown Artist',
        album: tags.album || 'Unknown Album',
        genre: tags.genre,
        year: tags.year,
        hasArtwork: !!tags.image,
        platform,
        sourceUrl,
        mtime: stat.mtime.getTime(),
      };

      this.cache.set(filename, track);
    } catch (error) {
      logger.warn(`Failed to cache track: ${filename}`, 'LibraryCache', { error });
    }
  }

  private removeFromCache(filename: string): void {
    this.cache.delete(filename);
    logger.debug(`Removed from cache: ${filename}`, 'LibraryCache');
  }

  private startWatcher(): void {
    this.watcher = chokidar.watch(this.libraryDir, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on('add', (filePath: string) => {
        const filename = path.basename(filePath);
        if (AUDIO_FORMATS.EXTENSIONS.some(ext => filename.endsWith(ext))) {
          logger.debug(`File added: ${filename}`, 'LibraryCache');
          this.addToCache(filename);
        }
      })
      .on('change', (filePath: string) => {
        const filename = path.basename(filePath);
        if (AUDIO_FORMATS.EXTENSIONS.some(ext => filename.endsWith(ext))) {
          logger.debug(`File changed: ${filename}`, 'LibraryCache');
          this.addToCache(filename);
        }
      })
      .on('unlink', (filePath: string) => {
        const filename = path.basename(filePath);
        logger.debug(`File removed: ${filename}`, 'LibraryCache');
        this.removeFromCache(filename);
      })
      .on('error', (error: unknown) => {
        logger.error('Watcher error', 'LibraryCache', { error });
      });

    logger.info('File system watcher started', 'LibraryCache');
  }

  getTracks(page: number = 1, limit: number = 12): { tracks: CachedTrack[]; total: number; hasMore: boolean } {
    const allTracks = Array.from(this.cache.values())
      .sort((a, b) => b.mtime - a.mtime);

    const total = allTracks.length;
    const start = (page - 1) * limit;
    const tracks = allTracks.slice(start, start + limit);

    return {
      tracks,
      total,
      hasMore: start + limit < total,
    };
  }

  searchTracks(query: string, maxResults: number = 50): CachedTrack[] {
    const lowerQuery = query.toLowerCase();
    const results: CachedTrack[] = [];

    for (const track of this.cache.values()) {
      if (
        track.title.toLowerCase().includes(lowerQuery) ||
        track.artist.toLowerCase().includes(lowerQuery) ||
        track.album.toLowerCase().includes(lowerQuery)
      ) {
        results.push(track);
        if (results.length >= maxResults) break;
      }
    }

    return results;
  }

  getTrack(id: string): CachedTrack | undefined {
    const filename = Buffer.from(id, 'base64').toString('utf-8');
    return this.cache.get(filename);
  }

  invalidate(): void {
    logger.info('Invalidating cache and rescanning...', 'LibraryCache');
    this.cache.clear();
    this.scanLibrary();
  }

  cleanup(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logger.info('File system watcher stopped', 'LibraryCache');
    }
    this.cache.clear();
    this.isInitialized = false;
  }

  getStats(): { totalTracks: number; libraryDir: string } {
    return {
      totalTracks: this.cache.size,
      libraryDir: this.libraryDir,
    };
  }
}

export const libraryCache = new LibraryCache();
