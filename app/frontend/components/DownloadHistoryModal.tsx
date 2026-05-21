'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, ExternalLink, Search, Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface HistoryItem {
  url: string;
  title: string | null;
  artist: string | null;
  downloadedAt: string;
}

interface DownloadHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backendUrl: string;
  onRedownload: (url: string) => void;
}

export function DownloadHistoryModal({
  open,
  onOpenChange,
  backendUrl,
  onRedownload,
}: DownloadHistoryModalProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/settings/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load download history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(item => {
    const query = searchQuery.toLowerCase();
    return (
      item.url.toLowerCase().includes(query) ||
      item.title?.toLowerCase().includes(query) ||
      item.artist?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Download History</DialogTitle>
          <DialogDescription>
            View and manage your previously downloaded tracks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading history...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'No matching downloads found' : 'No download history yet'}
              </div>
            ) : (
              filteredHistory.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {item.title || 'Unknown Title'}
                    </div>
                    {item.artist && (
                      <div className="text-sm text-muted-foreground truncate">
                        {item.artist}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(item.downloadedAt)}
                    </div>
                  </div>

                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(item.url, '_blank')}
                      title="Open source URL"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onRedownload(item.url);
                        onOpenChange(false);
                      }}
                      title="Download again"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {filteredHistory.length > 0 && (
            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              Showing {filteredHistory.length} of {history.length} downloads
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
