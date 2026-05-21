import axios from 'axios';
import NodeID3 from 'node-id3';
import * as fs from 'fs';
import * as path from 'path';

interface iTunesResult {
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  trackNumber?: number;
  trackCount?: number;
  releaseDate?: string;
  primaryGenreName?: string;
}

interface TrackMetadata {
  title: string;
  artist: string;
  album?: string;
  artwork?: Buffer;
  trackNumber?: number;
  year?: string;
  genre?: string;
  platform?: 'youtube' | 'soundcloud';
  sourceUrl?: string;
}

export async function searchItunes(query: string): Promise<iTunesResult | null> {
  try {
    const response = await axios.get('https://itunes.apple.com/search', {
      params: {
        term: query,
        media: 'music',
        entity: 'song',
        limit: 5,
      },
      timeout: 10000,
    });

    if (response.data.resultCount > 0) {
      return response.data.results[0];
    }
    return null;
  } catch (error) {
    console.error('iTunes search error:', error);
    return null;
  }
}

interface MusicBrainzResult {
  title: string;
  'artist-credit'?: { name: string }[];
  releases?: { title: string; date?: string }[];
}

export async function searchMusicBrainz(query: string): Promise<TrackMetadata | null> {
  try {
    const response = await axios.get('https://musicbrainz.org/ws/2/recording', {
      params: {
        query: query,
        fmt: 'json',
        limit: 5,
      },
      headers: {
        'User-Agent': 'Audiyo/1.0.0 (https://github.com/audiyo)',
      },
      timeout: 10000,
    });

    if (response.data.recordings && response.data.recordings.length > 0) {
      const recording: MusicBrainzResult = response.data.recordings[0];
      const artist = recording['artist-credit']?.[0]?.name || '';
      const album = recording.releases?.[0]?.title || '';
      const year = recording.releases?.[0]?.date?.split('-')[0] || '';

      return {
        title: recording.title,
        artist,
        album: album || undefined,
        year: year || undefined,
      };
    }
    return null;
  } catch (error) {
    console.error('MusicBrainz search error:', error);
    return null;
  }
}


export function detectPlatform(url: string): 'youtube' | 'soundcloud' | 'unknown' {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  }
  if (url.includes('soundcloud.com')) {
    return 'soundcloud';
  }
  return 'unknown';
}


export function parseYouTubeTitle(title: string): { artist: string; trackTitle: string } {
  // Remove common YouTube suffixes
  let cleaned = title
    .replace(/\s*\[.*?\]\s*/g, '') // [Official Video], [Audio], etc.
    .replace(/\s*\(.*?(Official|Audio|Video|Lyrics|HD|HQ|4K).*?\)\s*/gi, '')
    .replace(/\s*\|.*$/g, '') // | Artist Name
    .replace(/\s*ft\.?\s+/gi, ' feat. ')
    .replace(/\s*feat\.?\s+/gi, ' feat. ')
    .trim();

  // Try to split by common delimiters
  const delimiters = [' - ', ' – ', ' — ', ' : '];
  
  for (const delimiter of delimiters) {
    if (cleaned.includes(delimiter)) {
      const parts = cleaned.split(delimiter);
      if (parts.length >= 2) {
        return {
          artist: parts[0].trim(),
          trackTitle: parts.slice(1).join(delimiter).trim(),
        };
      }
    }
  }

  // Fallback: use the whole title as track title
  return {
    artist: '',
    trackTitle: cleaned,
  };
}

async function downloadArtwork(url: string): Promise<Buffer | null> {
  try {
    // Get higher resolution artwork (replace 100x100 with 600x600)
    const highResUrl = url.replace('100x100', '600x600');
    
    const response = await axios.get(highResUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Artwork download error:', error);
    return null;
  }
}

export async function getMetadata(
  youtubeTitle: string, 
  youtubeArtist?: string, 
  url?: string
): Promise<TrackMetadata> {
  const detectedPlatform = url ? detectPlatform(url) : 'youtube';
  const platform: 'youtube' | 'soundcloud' | undefined = detectedPlatform === 'unknown' ? undefined : detectedPlatform;
  
  console.log(`[Metadata] Platform detected: ${platform}, URL: ${url}`);
  console.log(`[Metadata] yt-dlp provided - Title: "${youtubeTitle}", Artist: "${youtubeArtist}"`);
  
  // For SoundCloud, use yt-dlp metadata directly (API often returns 403)
  if (platform === 'soundcloud') {
    console.log(`[Metadata] Using yt-dlp metadata for SoundCloud track`);
    
    // yt-dlp already provides good metadata for SoundCloud
    const parsed = parseYouTubeTitle(youtubeTitle);
    const artist = youtubeArtist || parsed.artist || 'Unknown Artist';
    const title = parsed.trackTitle || youtubeTitle;
    
    return {
      title,
      artist,
      platform: 'soundcloud',
      sourceUrl: url,
    };
  }

  const parsed = parseYouTubeTitle(youtubeTitle);
  
  // Use YouTube artist if provided and we couldn't parse one
  const artist = parsed.artist || youtubeArtist || '';
  const title = parsed.trackTitle;

  // Search iTunes with different query strategies
  const queries = [
    `${artist} ${title}`.trim(),
    title,
    artist ? `${artist}` : null,
  ].filter(Boolean) as string[];

  let itunesResult: iTunesResult | null = null;

  for (const query of queries) {
    itunesResult = await searchItunes(query);
    if (itunesResult) {
      // Verify it's a reasonable match
      const resultTitle = itunesResult.trackName.toLowerCase();
      const searchTitle = title.toLowerCase();
      
      // Check if titles have some overlap
      const titleWords = searchTitle.split(/\s+/).filter(w => w.length > 2);
      const matchingWords = titleWords.filter(w => resultTitle.includes(w));
      
      if (matchingWords.length >= Math.min(2, titleWords.length)) {
        break;
      }
      // If no match, try next query
      itunesResult = null;
    }
  }

  if (itunesResult) {
    const artwork = await downloadArtwork(itunesResult.artworkUrl100);
    
    return {
      title: itunesResult.trackName,
      artist: itunesResult.artistName,
      album: itunesResult.collectionName,
      artwork: artwork || undefined,
      trackNumber: itunesResult.trackNumber,
      year: itunesResult.releaseDate ? new Date(itunesResult.releaseDate).getFullYear().toString() : undefined,
      genre: itunesResult.primaryGenreName,
      platform,
      sourceUrl: url,
    };
  }

  // Try MusicBrainz as fallback
  const mbQuery = `${artist} ${title}`.trim();
  const mbResult = await searchMusicBrainz(mbQuery);
  
  if (mbResult && mbResult.artist) {
    return {
      title: mbResult.title || title,
      artist: mbResult.artist,
      album: mbResult.album,
      year: mbResult.year,
      platform,
      sourceUrl: url,
    };
  }

  // Final fallback to parsed YouTube metadata
  return {
    title: title,
    artist: artist,
    platform,
    sourceUrl: url,
  };
}

export async function applyMetadata(
  filePath: string,
  metadata: TrackMetadata,
  logCallback?: (message: string) => void
): Promise<{ success: boolean; error?: string; newPath?: string }> {
  const log = logCallback || console.log;

  try {
    // Read existing tags to preserve artwork if no new artwork provided
    const existingTags = NodeID3.read(filePath);
    
    const tags: NodeID3.Tags = {
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album || existingTags.album || 'Unknown Album',
      year: metadata.year,
      genre: metadata.genre,
      trackNumber: metadata.trackNumber?.toString(),
      comment: {
        language: 'eng',
        text: metadata.sourceUrl || (metadata.platform ? `Downloaded from ${metadata.platform}` : 'Downloaded with Synchrio'),
      },
    };

    if (metadata.artwork) {
      tags.image = {
        mime: 'image/jpeg',
        type: { id: 3, name: 'front cover' },
        description: 'Cover',
        imageBuffer: metadata.artwork,
      };
      log(`Embedded iTunes artwork (${Math.round(metadata.artwork.length / 1024)}KB)`);
    } else if (existingTags.image) {
      // Preserve existing artwork from YouTube thumbnail
      tags.image = existingTags.image;
      log('Preserved existing YouTube thumbnail as artwork');
    }

    log(`Applying tags: ${metadata.artist} - ${metadata.title}`);
    if (metadata.album) log(`Album: ${metadata.album}`);
    if (metadata.year) log(`Year: ${metadata.year}`);
    if (metadata.genre) log(`Genre: ${metadata.genre}`);

    const success = NodeID3.write(tags, filePath);
    
    if (!success) {
      return { success: false, error: 'Failed to write ID3 tags' };
    }

    // Rename file to clean format: Artist - Title.mp3
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const cleanArtist = metadata.artist.replace(/[<>:"/\\|?*]/g, '').trim();
    const cleanTitle = metadata.title.replace(/[<>:"/\\|?*]/g, '').trim();
    const newFileName = cleanArtist 
      ? `${cleanArtist} - ${cleanTitle}${ext}`
      : `${cleanTitle}${ext}`;
    const newPath = path.join(dir, newFileName);

    if (newPath !== filePath && !fs.existsSync(newPath)) {
      fs.renameSync(filePath, newPath);
      log(`Renamed to: ${newFileName}`);
      return { success: true, newPath };
    }

    return { success: true, newPath: filePath };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown tagging error' 
    };
  }
}

export async function tagFile(
  filePath: string,
  youtubeTitle: string,
  youtubeArtist?: string,
  logCallback?: (message: string) => void,
  url?: string
): Promise<{ success: boolean; error?: string; newPath?: string }> {
  const log = logCallback || console.log;

  log('Searching for metadata...');
  const metadata = await getMetadata(youtubeTitle, youtubeArtist, url);

  if (metadata.album) {
    log(`Found match: ${metadata.artist} - ${metadata.title} (${metadata.album})`);
  } else {
    log(`No iTunes match, using YouTube metadata: ${metadata.artist} - ${metadata.title}`);
  }

  return applyMetadata(filePath, metadata, logCallback);
}
