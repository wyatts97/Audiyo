'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format: string;
  setFormat: (format: string) => void;
  libraryPath: string;
  setLibraryPath: (path: string) => void;
  showPlatformBadges: boolean;
  setShowPlatformBadges: (show: boolean) => void;
  onSaveLibraryPath: () => void;
  backendUrl: string;
}

export function SettingsModal({
  open,
  onOpenChange,
  format,
  setFormat,
  libraryPath,
  setLibraryPath,
  showPlatformBadges,
  setShowPlatformBadges,
  onSaveLibraryPath,
  backendUrl,
}: SettingsModalProps) {
  const { toast } = useToast();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your download preferences and library settings
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Default Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp3">MP3</SelectItem>
                <SelectItem value="opus">Opus</SelectItem>
                <SelectItem value="flac">FLAC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Library Folder Path</Label>
            <div className="flex gap-2">
              <Input 
                value={libraryPath} 
                onChange={(e) => setLibraryPath(e.target.value)}
                placeholder="e.g., C:\Music\Library"
              />
              <Button size="sm" onClick={onSaveLibraryPath}>
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">The app will scan this folder for existing audio files</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>Show Platform Badges</Label>
                <p className="text-xs text-muted-foreground">Display YouTube/SoundCloud icons on artwork (hover to see)</p>
              </div>
              <button
                onClick={async () => {
                  const newValue = !showPlatformBadges;
                  setShowPlatformBadges(newValue);
                  try {
                    await fetch(`${backendUrl}/api/settings`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ showPlatformBadges: newValue })
                    });
                    toast({ title: 'Settings saved', description: `Platform badges ${newValue ? 'enabled' : 'disabled'}`, duration: 8000 });
                  } catch (e) {
                    toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showPlatformBadges ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showPlatformBadges ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground mb-2">About</p>
            <p className="text-xs text-muted-foreground">Synchrio - YouTube & SoundCloud songs, organized.</p>
            <p className="text-xs text-muted-foreground">Metadata sources: SoundCloud API, iTunes, MusicBrainz</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
