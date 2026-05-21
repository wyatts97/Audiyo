'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Music, Play, Edit, Download, Trash2, Check, X } from 'lucide-react';

interface LibraryTrack {
  id: string;
  filename: string;
  title: string;
  artist: string;
  album: string;
  hasArtwork: boolean;
  platform?: 'youtube' | 'soundcloud';
  sourceUrl?: string;
}

interface TrackDetailsModalProps {
  track: LibraryTrack | null;
  onClose: () => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  editForm: { title: string; artist: string; album: string };
  setEditForm: (form: { title: string; artist: string; album: string }) => void;
  onPlay: (track: LibraryTrack) => void;
  onSave: () => void;
  onDelete: (track: LibraryTrack) => void;
  backendUrl: string;
}

export function TrackDetailsModal({
  track,
  onClose,
  isEditing,
  setIsEditing,
  editForm,
  setEditForm,
  onPlay,
  onSave,
  onDelete,
  backendUrl,
}: TrackDetailsModalProps) {
  if (!track) return null;

  return (
    <Dialog open={!!track} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Track' : 'Track Details'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update track metadata' : 'View and manage track information'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="aspect-square w-32 mx-auto rounded-xl overflow-hidden">
            {track.hasArtwork ? (
              <img src={`${backendUrl}/api/library/artwork/${track.id}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <Music className="h-12 w-12 text-primary/40" />
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div>
                <Label>Artist</Label>
                <Input value={editForm.artist} onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })} />
              </div>
              <div>
                <Label>Album</Label>
                <Input value={editForm.album} onChange={(e) => setEditForm({ ...editForm, album: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={onSave}><Check className="h-4 w-4 mr-2" />Save</Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h3 className="font-semibold text-lg">{track.title}</h3>
                <p className="text-muted-foreground">{track.artist}</p>
                <p className="text-sm text-muted-foreground">{track.album}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => onPlay(track)}>
                  <Play className="h-4 w-4 mr-2" />Play
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />Edit
                </Button>
                <Button variant="outline" asChild>
                  <a href={`${backendUrl}/api/library/download/${track.id}`}>
                    <Download className="h-4 w-4 mr-2" />Download
                  </a>
                </Button>
                <Button variant="destructive" onClick={() => onDelete(track)}>
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
