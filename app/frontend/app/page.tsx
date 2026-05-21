'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { TiltCard } from '@/components/ui/tilt-card'
import { getWebSocketManager } from '@/lib/websocket'
import { 
  Music, 
  Download, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Trash2,
  Moon,
  Sun,
  Square,
  Library,
  Search,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Edit,
  X,
  Check,
  ExternalLink,
  Settings,
  ChevronRight,
  History
} from 'lucide-react'
import { useTheme } from 'next-themes'

const DownloadHistoryModal = dynamic(() => 
  import('@/components/DownloadHistoryModal').then(m => ({ default: m.DownloadHistoryModal })), 
  { ssr: false }
)

type JobStatus = 'QUEUED' | 'DOWNLOADING' | 'TAGGING' | 'COMPLETED' | 'FAILED'

interface Job {
  id: string
  url: string
  status: JobStatus
  format: string
  createdAt: string
  updatedAt: string
  error?: string
  logs?: string[]
  title?: string
  artist?: string
  isPlaylist?: boolean
  totalTracks?: number
  completedTracks?: number
  progress?: number
}

interface LibraryTrack {
  id: string
  filename: string
  title: string
  artist: string
  album: string
  genre?: string
  year?: string
  hasArtwork: boolean
  platform?: 'youtube' | 'soundcloud'
  sourceUrl?: string
}

const BACKEND_URL = ''

export default function Home() {
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState('mp3')
  const [jobs, setJobs] = useState<Job[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
  const [showJobs, setShowJobs] = useState(true)
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Library state
  const [libraryTracks, setLibraryTracks] = useState<LibraryTrack[]>([])
  const [libraryPage, setLibraryPage] = useState(1)
  const [hasMoreTracks, setHasMoreTracks] = useState(true)
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const libraryRef = useRef<HTMLDivElement>(null)

  // Audio player state
  const [currentTrack, setCurrentTrack] = useState<LibraryTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Track modal state
  const [selectedTrack, setSelectedTrack] = useState<LibraryTrack | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', artist: '', album: '' })

  // Bulk selection state
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)

  // Settings state
  const [showSettings, setShowSettings] = useState(false)
  const [libraryPath, setLibraryPath] = useState('')
  const [showPlatformBadges, setShowPlatformBadges] = useState(true)

  // History state
  const [showHistory, setShowHistory] = useState(false)

  // Player state
  const [playerExpanded, setPlayerExpanded] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    setMounted(true)
    
    // Fetch settings
    fetch(`${BACKEND_URL}/api/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.libraryPath) setLibraryPath(data.libraryPath)
        if (data.showPlatformBadges !== undefined) setShowPlatformBadges(data.showPlatformBadges)
      })
      .catch(console.error)
    
    // Connect WebSocket with auto-reconnection
    const ws = getWebSocketManager()
    ws.connect()
    
    const unsubscribeJobUpdate = ws.on('job:update', (data) => {
      fetchJobs()
      if (data.status === 'COMPLETED') {
        toast({ title: 'Download Complete', description: 'Track added to library', duration: 8000 })
      }
    })
    
    const unsubscribeLibraryUpdate = ws.on('library:update', () => {
      fetchLibrary(1)
    })
    
    return () => {
      unsubscribeJobUpdate()
      unsubscribeLibraryUpdate()
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+V or Cmd+V to focus input
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (document.activeElement !== inputRef.current) {
          inputRef.current?.focus()
        }
      }
      // Escape to close modal
      if (e.key === 'Escape') {
        setSelectedTrack(null)
        setIsEditing(false)
      }
      // Space to play/pause (when not typing)
      if (e.key === ' ' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        togglePlayPause()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTrack, isPlaying])

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs`)
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    }
  }, [])

  const fetchLibrary = useCallback(async (page: number, append: boolean = false) => {
    if (loadingLibrary) return
    setLoadingLibrary(true)
    try {
      const response = await fetch(`${BACKEND_URL}/api/library?page=${page}&limit=12`)
      if (response.ok) {
        const data = await response.json()
        if (append) {
          setLibraryTracks(prev => [...prev, ...data.tracks])
        } else {
          setLibraryTracks(data.tracks)
        }
        setHasMoreTracks(data.hasMore)
        setLibraryPage(page)
      }
    } catch (error) {
      console.error('Failed to fetch library:', error)
    } finally {
      setLoadingLibrary(false)
    }
  }, [])

  const searchLibrary = useCallback(async (query: string) => {
    if (!query.trim()) {
      setIsSearching(false)
      fetchLibrary(1)
      return
    }
    
    setIsSearching(true)
    try {
      const response = await fetch(`${BACKEND_URL}/api/library/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setLibraryTracks(data.tracks)
        setHasMoreTracks(false)
      }
    } catch (error) {
      console.error('Failed to search library:', error)
    }
  }, [fetchLibrary])

  useEffect(() => {
    fetchJobs()
    fetchLibrary(1)
    const interval = setInterval(fetchJobs, 5000)
    return () => clearInterval(interval)
  }, [fetchJobs])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchLibrary(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchLibrary])

  // Infinite scroll
  useEffect(() => {
    if (isSearching) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreTracks && !loadingLibrary) {
          fetchLibrary(libraryPage + 1, true)
        }
      },
      { threshold: 0.1 }
    )

    if (libraryRef.current) {
      observer.observe(libraryRef.current)
    }

    return () => observer.disconnect()
  }, [hasMoreTracks, loadingLibrary, libraryPage, fetchLibrary, isSearching])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url.trim()) {
      toast({ title: 'Error', description: 'Please enter a URL', variant: 'destructive' })
      return
    }

    // Parse multiple URLs (one per line)
    const urls = url.split('\n').map(u => u.trim()).filter(u => u.length > 0)
    
    // Validate all URLs
    const invalidUrls = urls.filter(u => {
      const isYouTube = u.includes('youtube.com') || u.includes('youtu.be') || u.includes('music.youtube.com')
      const isSoundCloud = u.includes('soundcloud.com')
      return !isYouTube && !isSoundCloud
    })
    
    if (invalidUrls.length > 0) {
      toast({ 
        title: 'Error', 
        description: `Invalid URL(s): ${invalidUrls.length} URL(s) are not YouTube or SoundCloud`, 
        variant: 'destructive' 
      })
      return
    }

    setIsSubmitting(true)
    let successCount = 0
    let errorCount = 0
    
    try {
      // Process each URL
      for (const singleUrl of urls) {
        try {
          const response = await fetch(`${BACKEND_URL}/api/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: singleUrl, format }),
          })

          if (response.ok) {
            successCount++
          } else if (response.status === 409) {
            // Duplicate - skip silently or count as success
            successCount++
          } else {
            errorCount++
          }
        } catch {
          errorCount++
        }
      }
      
      // Show summary toast
      if (successCount > 0) {
        toast({ 
          title: 'Downloads Started', 
          description: `${successCount} track(s) queued${errorCount > 0 ? `, ${errorCount} failed` : ''}`, 
          duration: 8000 
        })
        setUrl('')
        fetchJobs()
        setShowJobs(true)
      } else {
        toast({ title: 'Error', description: 'All downloads failed', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to connect to server', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (jobId: string) => {
    await fetch(`${BACKEND_URL}/api/jobs/${jobId}`, { method: 'DELETE' })
    fetchJobs()
  }

  const handleRetry = async (jobId: string) => {
    await fetch(`${BACKEND_URL}/api/jobs/${jobId}/retry`, { method: 'POST' })
    fetchJobs()
  }

  const handleCancel = async (jobId: string) => {
    await fetch(`${BACKEND_URL}/api/jobs/${jobId}/cancel`, { method: 'POST' })
    fetchJobs()
  }

  const toggleJobExpanded = (jobId: string) => {
    const newExpanded = new Set(expandedJobs)
    if (newExpanded.has(jobId)) newExpanded.delete(jobId)
    else newExpanded.add(jobId)
    setExpandedJobs(newExpanded)
  }

  // Audio player functions
  const playTrack = (track: LibraryTrack) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    
    const audio = new Audio(`${BACKEND_URL}/api/library/stream/${track.id}`)
    audio.volume = isMuted ? 0 : volume
    
    audio.onended = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      // Auto-play next track
      const currentIndex = libraryTracks.findIndex(t => t.id === track.id)
      if (currentIndex < libraryTracks.length - 1) {
        playTrack(libraryTracks[currentIndex + 1])
      }
    }

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime)
    }

    audio.onloadedmetadata = () => {
      setDuration(audio.duration)
    }
    
    audio.play()
    audioRef.current = audio
    setCurrentTrack(track)
    setIsPlaying(true)
    setPlayerExpanded(true)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = percent * duration
  }

  const togglePlayPause = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const skipTrack = (direction: 'prev' | 'next') => {
    if (!currentTrack) return
    const currentIndex = libraryTracks.findIndex(t => t.id === currentTrack.id)
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1
    
    if (newIndex >= 0 && newIndex < libraryTracks.length) {
      playTrack(libraryTracks[newIndex])
    }
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? volume : 0
    }
    setIsMuted(!isMuted)
  }

  // Track modal functions
  const openTrackModal = (track: LibraryTrack) => {
    setSelectedTrack(track)
    setEditForm({ title: track.title, artist: track.artist, album: track.album })
    setIsEditing(false)
  }

  const deleteTrack = async (track: LibraryTrack) => {
    if (!confirm(`Delete "${track.title}"?`)) return
    
    await fetch(`${BACKEND_URL}/api/library/track/${track.id}`, { method: 'DELETE' })
    setSelectedTrack(null)
    
    if (currentTrack?.id === track.id) {
      audioRef.current?.pause()
      setCurrentTrack(null)
      setIsPlaying(false)
    }
    
    fetchLibrary(1)
    toast({ title: 'Track Deleted', duration: 8000 })
  }

  // Bulk selection functions
  const toggleTrackSelection = (trackId: string) => {
    const newSelected = new Set(selectedTracks)
    if (newSelected.has(trackId)) {
      newSelected.delete(trackId)
    } else {
      newSelected.add(trackId)
    }
    setSelectedTracks(newSelected)
  }

  const selectAllTracks = () => {
    if (selectedTracks.size === libraryTracks.length) {
      setSelectedTracks(new Set())
    } else {
      setSelectedTracks(new Set(libraryTracks.map(t => t.id)))
    }
  }

  const bulkDeleteTracks = async () => {
    if (selectedTracks.size === 0) return
    if (!confirm(`Delete ${selectedTracks.size} tracks?`)) return
    
    for (const trackId of selectedTracks) {
      await fetch(`${BACKEND_URL}/api/library/track/${trackId}`, { method: 'DELETE' })
      
      if (currentTrack?.id === trackId) {
        audioRef.current?.pause()
        setCurrentTrack(null)
        setIsPlaying(false)
      }
    }
    
    setSelectedTracks(new Set())
    setBulkMode(false)
    fetchLibrary(1)
    toast({ title: `Deleted ${selectedTracks.size} tracks`, duration: 8000 })
  }

  const exitBulkMode = () => {
    setBulkMode(false)
    setSelectedTracks(new Set())
  }

  const saveTrackEdit = async () => {
    if (!selectedTrack) return
    
    const response = await fetch(`${BACKEND_URL}/api/library/track/${selectedTrack.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    
    if (response.ok) {
      toast({ title: 'Track Updated', duration: 8000 })
      setIsEditing(false)
      fetchLibrary(1)
      setSelectedTrack(null)
    } else {
      toast({ title: 'Error', description: 'Failed to update track', variant: 'destructive' })
    }
  }

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'QUEUED': return <Clock className="h-3 w-3" />
      case 'DOWNLOADING': return <Download className="h-3 w-3 animate-pulse" />
      case 'TAGGING': return <Loader2 className="h-3 w-3 animate-spin" />
      case 'COMPLETED': return <CheckCircle2 className="h-3 w-3" />
      case 'FAILED': return <XCircle className="h-3 w-3" />
    }
  }

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'QUEUED': return 'bg-zinc-500'
      case 'DOWNLOADING': case 'TAGGING': return 'bg-blue-500'
      case 'COMPLETED': return 'bg-green-500'
      case 'FAILED': return 'bg-red-500'
    }
  }

  const activeJobs = jobs.filter(j => j.status !== 'COMPLETED' && j.status !== 'FAILED')

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/80 pb-24">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 flex flex-col items-center">
          <div className="mb-4">
            <img src="/icon-192.png" alt="audiyo" className="h-24 w-24 sm:h-30 sm:w-30 rounded-2xl" />
          </div>
          <TiltCard className="inline-block mb-2">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-[family-name:var(--font-special-gothic)] bg-gradient-to-br from-gray-200 via-gray-400 to-gray-600 bg-clip-text text-transparent" style={{
              textShadow: '0 1px 3px rgba(255,255,255,0.3), 0 8px 16px rgba(0,0,0,0.3)',
              WebkitTextStroke: '0.5px rgba(255,255,255,0.2)'
            }}>
              audiyo
            </h1>
          </TiltCard>
          <p className="text-muted-foreground text-sm sm:text-base">YouTube & SoundCloud songs, organized.</p>
          {mounted && (
            <div className="absolute top-4 right-4 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHistory(true)}
                title="Download History"
              >
                <History className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                title="Settings"
              >
                <Settings className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </div>
          )}
        </div>

        {/* URL Input */}
        <div className="bg-card border rounded-2xl p-4 sm:p-6 shadow-lg mb-6 sm:mb-8">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <textarea
                ref={inputRef as any}
                placeholder="Paste YouTube or SoundCloud URLs here (one per line)..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 min-h-[44px] sm:min-h-[48px] max-h-[300px] text-sm sm:text-base rounded-xl bg-background border border-input px-3 py-2 resize-none overflow-y-auto"
                disabled={isSubmitting}
                rows={1}
                style={{ height: 'auto', minHeight: '44px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = Math.min(target.scrollHeight, 300) + 'px'
                }}
              />
              <Select value={format} onValueChange={setFormat} disabled={isSubmitting}>
                <SelectTrigger className="w-full sm:w-28 h-11 sm:h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp3">MP3</SelectItem>
                  <SelectItem value="opus">Opus</SelectItem>
                  <SelectItem value="flac">FLAC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full h-11 sm:h-12 text-sm sm:text-base rounded-xl"
              size="lg"
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />Processing...</>
              ) : (
                <><Download className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />Download {url.split('\n').filter(u => u.trim()).length > 1 ? `(${url.split('\n').filter(u => u.trim()).length})` : ''}</>
              )}
            </Button>
          </form>
        </div>

        {/* Jobs Section */}
        {jobs.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <button
              onClick={() => setShowJobs(!showJobs)}
              className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground mb-3 sm:mb-4 transition-colors"
            >
              {showJobs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span>{activeJobs.length} active, {jobs.length - activeJobs.length} completed</span>
            </button>

            {showJobs && (
              <div className="space-y-2">
                {jobs.slice(0, 10).map((job) => (
                  <Collapsible key={job.id} open={expandedJobs.has(job.id)} onOpenChange={() => toggleJobExpanded(job.id)}>
                    <div className="bg-card border rounded-xl p-3 sm:p-4 transition-all hover:shadow-md">
                      <div className="flex items-center justify-between gap-2 sm:gap-4">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(job.status)}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-xs sm:text-sm">{job.title || 'Processing...'}</p>
                            {job.artist && <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{job.artist}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px] sm:text-xs hidden sm:flex">
                            {getStatusIcon(job.status)}<span className="ml-1">{job.status}</span>
                          </Badge>
                          {(job.status === 'QUEUED' || job.status === 'DOWNLOADING' || job.status === 'TAGGING') && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => handleCancel(job.id)}>
                              <Square className="h-3 w-3" />
                            </Button>
                          )}
                          {job.status === 'FAILED' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => handleRetry(job.id)}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                          {(job.status === 'COMPLETED' || job.status === 'FAILED') && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => handleDelete(job.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8">
                              <ChevronDown className={`h-3 w-3 transition-transform ${expandedJobs.has(job.id) ? 'rotate-180' : ''}`} />
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                      <CollapsibleContent>
                        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t text-[10px] sm:text-xs space-y-2">
                          <p className="text-muted-foreground break-all">{job.url}</p>
                          {job.error && <p className="text-red-500">{job.error}</p>}
                          {job.logs && job.logs.length > 0 && (
                            <pre className="p-2 bg-muted rounded-lg overflow-x-auto max-h-24 sm:max-h-32 text-[9px] sm:text-[10px]">
                              {job.logs.slice(-8).join('\n')}
                            </pre>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Library Section */}
        <div className="mt-8 sm:mt-12">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-2">
              <Library className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg sm:text-xl font-semibold">Your Library</h2>
              <span className="text-xs sm:text-sm text-muted-foreground">({libraryTracks.length})</span>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 sm:h-10 rounded-xl text-sm"
                />
              </div>
              {libraryTracks.length > 0 && (
                <>
                  {bulkMode && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTracks(new Set(libraryTracks.map(t => t.id)))}
                        className="h-9 sm:h-10 text-xs"
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTracks(new Set())}
                        className="h-9 sm:h-10 text-xs"
                      >
                        Deselect All
                      </Button>
                      {selectedTracks.size > 0 && (
                        <Badge variant="secondary" className="h-9 sm:h-10 px-3">
                          {selectedTracks.size} selected
                        </Badge>
                      )}
                    </>
                  )}
                  <Button
                    variant={bulkMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
                    className="h-9 sm:h-10 text-xs"
                  >
                    {bulkMode ? 'Cancel' : 'Select'}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {bulkMode && selectedTracks.size > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-card border rounded-xl">
              <span className="text-sm font-medium">{selectedTracks.size} selected</span>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={selectAllTracks}>
                {selectedTracks.size === libraryTracks.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button variant="destructive" size="sm" onClick={bulkDeleteTracks}>
                <Trash2 className="h-4 w-4 mr-1" />Delete
              </Button>
            </div>
          )}

          {libraryTracks.length === 0 && !loadingLibrary ? (
            <div className="text-center py-12 sm:py-16 text-muted-foreground">
              <Music className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-20" />
              <p className="text-sm sm:text-base">{searchQuery ? 'No matches found' : 'Your library is empty'}</p>
              <p className="text-xs sm:text-sm">{!searchQuery && 'Downloaded tracks will appear here'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {libraryTracks.map((track) => (
                <div key={track.id} className="relative group">
                  <TiltCard 
                    className="cursor-pointer" 
                    onClick={() => bulkMode ? toggleTrackSelection(track.id) : openTrackModal(track)}
                  >
                    <div className={`relative aspect-square rounded-xl overflow-hidden bg-card border shadow-lg ${bulkMode && selectedTracks.has(track.id) ? 'ring-2 ring-primary' : ''}`}>
                      {track.hasArtwork ? (
                        <img
                          src={`${BACKEND_URL}/api/library/artwork/${track.id}`}
                          alt={track.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <Music className="h-8 w-8 sm:h-12 sm:w-12 text-primary/40" />
                        </div>
                      )}

                      {/* Bulk selection checkbox */}
                      {bulkMode && (
                        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedTracks.has(track.id) ? 'bg-primary border-primary' : 'bg-black/50 border-white'}`}>
                          {selectedTracks.has(track.id) && <Check className="h-4 w-4 text-white" />}
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                        <p className="text-white font-medium text-xs sm:text-sm truncate">{track.title}</p>
                        <p className="text-white/70 text-[10px] sm:text-xs truncate">{track.artist}</p>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <Play className="h-5 w-5 sm:h-7 sm:w-7 text-black ml-[2px]" fill="currentColor" />
                        </div>
                      </div>
                    </div>
                  </TiltCard>
                  
                  {/* Platform icon - OUTSIDE TiltCard to prevent click propagation issues */}
                  {showPlatformBadges && track.platform && track.sourceUrl && !bulkMode && (
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        window.open(track.sourceUrl, '_blank')
                      }}
                      className="absolute top-2 right-2 z-10 p-2 rounded-lg bg-black/80 backdrop-blur-sm border border-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/90 hover:scale-110"
                      title={`Open on ${track.platform === 'soundcloud' ? 'SoundCloud' : 'YouTube'}`}
                    >
                      {track.platform === 'soundcloud' ? (
                        <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M7 17.939h-1v-8.068c.308-.231.639-.429 1-.566v8.634zm3 0h1v-9.224c-.229.265-.443.548-.621.857l-.379-.184v8.551zm-2 0h1v-8.848c-.508-.079-.623-.05-1-.01v8.858zm-4 0h1v-7.02c-.312.458-.555.971-.692 1.535l-.308-.182v5.667zm-3-5.25c-.606.547-1 1.354-1 2.268 0 .914.394 1.721 1 2.268v-4.536zm18.879-.671c-.204-2.837-2.404-5.079-5.117-5.079-1.022 0-1.964.328-2.762.877v10.123h9.089c1.607 0 2.911-1.393 2.911-3.106 0-2.233-2.168-3.772-4.121-2.815zm-16.879-.027v5.127c.426.372.96.621 1.551.621.627 0 1.165-.26 1.551-.621v-5.127c-.386-.361-.924-.621-1.551-.621-.591 0-1.125.249-1.551.621z"/>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {hasMoreTracks && !isSearching && (
            <div ref={libraryRef} className="py-6 sm:py-8 flex justify-center">
              {loadingLibrary && <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-muted-foreground" />}
            </div>
          )}
        </div>
      </div>

      {/* Slide-up Right Side Audio Player */}
      {currentTrack && (
        <div className={`fixed right-4 bottom-4 z-50 transition-all duration-300 ease-out ${playerExpanded ? 'w-80' : 'w-14'}`}>
          <div className="bg-card border rounded-2xl shadow-2xl overflow-hidden">
            {playerExpanded ? (
              <div className="p-5">
                {/* Collapse button */}
                <button 
                  onClick={() => setPlayerExpanded(false)}
                  className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>

                {/* Artwork */}
                <div className="w-24 h-24 mx-auto rounded-full overflow-hidden bg-black mb-4 shadow-lg">
                  {currentTrack.hasArtwork ? (
                    <img src={`${BACKEND_URL}/api/library/artwork/${currentTrack.id}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-black flex items-center justify-center">
                      <Music className="h-10 w-10 text-white/60" />
                    </div>
                  )}
                </div>

                {/* Track info */}
                <div className="text-center mb-4">
                  <p className="font-semibold text-sm truncate">{currentTrack.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div 
                    className="h-1 bg-muted rounded-full cursor-pointer overflow-hidden"
                    onClick={seekTo}
                  >
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">{formatTime(currentTime)}</span>
                    <span className="text-[10px] text-muted-foreground">{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  <button onClick={() => skipTrack('prev')} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <SkipBack className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={togglePlayPause}
                    className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity"
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                  </button>
                  <button onClick={() => skipTrack('next')} className="p-2 hover:bg-muted rounded-full transition-colors">
                    <SkipForward className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Collapsed state - show artwork with music lines overlay */
              <button 
                onClick={() => setPlayerExpanded(true)}
                className="w-14 h-14 flex items-center justify-center hover:bg-muted/50 transition-colors relative"
              >
                {currentTrack.hasArtwork ? (
                  <img src={`${BACKEND_URL}/api/library/artwork/${currentTrack.id}`} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Music className="h-5 w-5 text-primary" />
                  </div>
                )}
                {/* Silver chrome music lines overlay */}
                {isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="flex gap-[2px] items-end h-5">
                      <div className="w-[2px] h-2 bg-gradient-to-b from-gray-200 via-gray-400 to-gray-600 rounded-full animate-pulse" style={{ animationDelay: '0ms', animationDuration: '600ms' }} />
                      <div className="w-[2px] h-4 bg-gradient-to-b from-gray-200 via-gray-400 to-gray-600 rounded-full animate-pulse" style={{ animationDelay: '100ms', animationDuration: '600ms' }} />
                      <div className="w-[2px] h-5 bg-gradient-to-b from-gray-200 via-gray-400 to-gray-600 rounded-full animate-pulse" style={{ animationDelay: '200ms', animationDuration: '600ms' }} />
                      <div className="w-[2px] h-3 bg-gradient-to-b from-gray-200 via-gray-400 to-gray-600 rounded-full animate-pulse" style={{ animationDelay: '300ms', animationDuration: '600ms' }} />
                      <div className="w-[2px] h-4 bg-gradient-to-b from-gray-200 via-gray-400 to-gray-600 rounded-full animate-pulse" style={{ animationDelay: '400ms', animationDuration: '600ms' }} />
                    </div>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
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
                <Button 
                  size="sm"
                  onClick={async () => {
                    try {
                      await fetch(`${BACKEND_URL}/api/settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ libraryPath })
                      })
                      toast({ title: 'Settings saved', description: 'Library path updated. Rescanning...', duration: 8000 })
                      fetchLibrary(1)
                    } catch (e) {
                      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' })
                    }
                  }}
                >
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
                    const newValue = !showPlatformBadges
                    setShowPlatformBadges(newValue)
                    try {
                      await fetch(`${BACKEND_URL}/api/settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ showPlatformBadges: newValue })
                      })
                      toast({ title: 'Settings saved', description: `Platform badges ${newValue ? 'enabled' : 'disabled'}`, duration: 8000 })
                    } catch (e) {
                      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' })
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
              <p className="text-xs text-muted-foreground">audiyo - YouTube & SoundCloud songs, organized.</p>
              <p className="text-xs text-muted-foreground">Metadata sources: SoundCloud API, iTunes, MusicBrainz</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Track Details Modal */}
      <Dialog open={!!selectedTrack} onOpenChange={(open) => !open && setSelectedTrack(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Track' : 'Track Details'}</DialogTitle>
          </DialogHeader>
          
          {selectedTrack && (
            <div className="space-y-4">
              <div className="aspect-square w-32 mx-auto rounded-xl overflow-hidden">
                {selectedTrack.hasArtwork ? (
                  <img src={`${BACKEND_URL}/api/library/artwork/${selectedTrack.id}`} alt="" className="w-full h-full object-cover" />
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
                    <Button className="flex-1" onClick={saveTrackEdit}><Check className="h-4 w-4 mr-2" />Save</Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">{selectedTrack.title}</h3>
                    <p className="text-muted-foreground">{selectedTrack.artist}</p>
                    <p className="text-sm text-muted-foreground">{selectedTrack.album}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => playTrack(selectedTrack)}>
                      <Play className="h-4 w-4 mr-2" />Play
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      <Edit className="h-4 w-4 mr-2" />Edit
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={`${BACKEND_URL}/api/library/download/${selectedTrack.id}`}>
                        <Download className="h-4 w-4 mr-2" />Download
                      </a>
                    </Button>
                    <Button variant="destructive" onClick={() => deleteTrack(selectedTrack)}>
                      <Trash2 className="h-4 w-4 mr-2" />Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Download History Modal */}
      <DownloadHistoryModal
        open={showHistory}
        onOpenChange={setShowHistory}
        backendUrl={BACKEND_URL}
        onRedownload={(url) => {
          setUrl(url);
          setShowHistory(false);
        }}
      />
    </main>
  )
}
