'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { 
  UploadCloud, 
  FileText, 
  Music, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Search, 
  Check, 
  X, 
  Trash2, 
  Plus, 
  Tag,
  Edit2,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  adminToggleSongApproval, 
  adminSetSongType, 
  adminCreateSongType, 
  adminDeleteSongType,
  adminDeleteSong, 
  SongTypeItem 
} from './actions';

interface SongRow {
  id: string;
  canonical_title: string;
  display_title: string;
  ministry_or_artist: string | null;
  song_type: string;
  types: string[];
  approval_status: 'pending_review' | 'approved' | 'rejected';
  created_at: string;
  section_count: number;
}

interface ImportRow {
  id: string;
  file_name: string;
  file_hash: string;
  status: string;
  detected_count: number;
  imported_count: number;
  duplicate_count: number;
  needs_review_count: number;
  created_at: string;
}

interface ParsedSection {
  section_type: string;
  section_label: string;
  section_order: number;
  lyrics_text: string;
  is_recognized: boolean;
}

interface ParsedSongPreview {
  display_title: string;
  canonical_title: string;
  ministry_or_artist: string | null;
  types: string[];
  song_type: string;
  approval_status: 'pending_review' | 'approved' | 'rejected';
  language: string;
  sections: ParsedSection[];
  warnings: Array<{ type: string; message: string }>;
  is_valid: boolean;
}

interface PreviewData {
  import_id: string;
  file_name: string;
  file_hash: string;
  is_duplicate_file: boolean;
  songs: ParsedSongPreview[];
  summary: {
    total_detected: number;
    total_duplicates: number;
    total_needs_review: number;
  };
}

export default function SongsManagerClient({
  initialSongs,
  initialTypes,
  recentImports,
}: {
  initialSongs: SongRow[];
  initialTypes: SongTypeItem[];
  recentImports: ImportRow[];
}) {
  const router = useRouter();
  const [songs, setSongs] = useState<SongRow[]>(initialSongs);
  const [availableTypes, setAvailableTypes] = useState<SongTypeItem[]>(initialTypes);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');

  // Upload & Preview state (Single type selection: default is 'worship')
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [defaultSelectedType, setDefaultSelectedType] = useState<string>('worship');
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});

  // Dynamic Type Edit State
  const [isEditingTypes, setIsEditingTypes] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [isSubmittingType, setIsSubmittingType] = useState(false);

  // Row Action State
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filter songs
  const filteredSongs = songs.filter((s) => {
    const matchesSearch =
      s.display_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.ministry_or_artist || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.types && s.types.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
    if (!matchesSearch) return false;

    if (statusFilter === 'APPROVED' && s.approval_status !== 'approved') return false;
    if (statusFilter === 'PENDING' && s.approval_status !== 'pending_review') return false;

    if (selectedTypeFilter !== 'ALL' && (!s.types || !s.types.includes(selectedTypeFilter))) return false;

    return true;
  });

  const handleCreateNewType = async () => {
    if (!newTypeName.trim()) return;

    setIsSubmittingType(true);
    try {
      const res = await adminCreateSongType(newTypeName);
      if (res.error) throw new Error(res.error);

      if (res.type) {
        setAvailableTypes((prev) => [...prev, res.type!]);
        // Automatically switch default selected type to this newly created type
        setDefaultSelectedType(res.type!.slug);
        toast.success(`Tag "${res.type.name}" created and selected!`);
      }
      setNewTypeName('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create type tag');
    } finally {
      setIsSubmittingType(false);
    }
  };

  const handleDeleteSongType = async (typeId: string, typeName: string, typeSlug: string) => {
    if (!confirm(`Are you sure you want to delete the type tag "${typeName}"?`)) return;

    try {
      const res = await adminDeleteSongType(typeId);
      if (res.error) throw new Error(res.error);

      setAvailableTypes((prev) => prev.filter((t) => t.id !== typeId));
      if (defaultSelectedType === typeSlug) {
        setDefaultSelectedType(availableTypes.find((t) => t.id !== typeId)?.slug || 'worship');
      }
      toast.success(`Type tag "${typeName}" deleted.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete type tag');
    }
  };

  // Single select for default upload type
  const selectDefaultType = (slug: string) => {
    if (isEditingTypes) return;
    setDefaultSelectedType(slug);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.docx')) {
        toast.error('Only .docx Word files are supported.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadAndPreview = async () => {
    if (!selectedFile) {
      toast.error('Please choose a .docx file.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('types', defaultSelectedType);

      const res = await fetch('/api/songs/import/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setPreviewData(data);
      toast.success(`Successfully parsed ${data.summary.total_detected} song(s) from document!`);
    } catch (err: any) {
      toast.error(err.message || 'Error uploading file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;

    setIsConfirming(true);
    try {
      const res = await fetch('/api/songs/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          import_id: previewData.import_id,
          songs: previewData.songs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Import confirmation failed');
      }

      toast.success(`Imported ${data.imported_count} song(s) into library (Pending Review)!`);
      setPreviewData(null);
      setSelectedFile(null);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Error confirming import');
    } finally {
      setIsConfirming(false);
    }
  };

  const updatePreviewSongTitle = (index: number, newTitle: string) => {
    if (!previewData) return;
    const updated = [...previewData.songs];
    updated[index].display_title = newTitle;
    setPreviewData({ ...previewData, songs: updated });
  };

  const updatePreviewSongArtist = (index: number, newArtist: string) => {
    if (!previewData) return;
    const updated = [...previewData.songs];
    updated[index].ministry_or_artist = newArtist;
    setPreviewData({ ...previewData, songs: updated });
  };

  // Single select for preview song type (selecting a new type replaces the old one)
  const selectPreviewSongType = (songIdx: number, typeSlug: string) => {
    if (!previewData) return;
    const updated = [...previewData.songs];
    updated[songIdx].types = [typeSlug];
    updated[songIdx].song_type = typeSlug;
    setPreviewData({ ...previewData, songs: updated });
  };

  const handleToggleApproval = async (songId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'approved' ? 'pending_review' : 'approved';
    setActionLoadingId(songId);
    try {
      const res = await adminToggleSongApproval(songId, nextStatus);
      if (res.error) throw new Error(res.error);
      
      setSongs((prev) =>
        prev.map((s) => (s.id === songId ? { ...s, approval_status: nextStatus } : s))
      );
      toast.success(nextStatus === 'approved' ? 'Song approved!' : 'Song reverted to pending review.');
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Single select for table row (clicking a type replaces previous type)
  const handleSelectSongType = async (songId: string, typeSlug: string) => {
    setActionLoadingId(`${songId}_${typeSlug}`);
    try {
      const res = await adminSetSongType(songId, typeSlug);
      if (res.error) throw new Error(res.error);

      if (res.types) {
        setSongs((prev) =>
          prev.map((s) => (s.id === songId ? { ...s, types: [typeSlug], song_type: typeSlug } : s))
        );
        toast.success(`Song type set to "${typeSlug.toUpperCase()}"`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update type');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteSong = async (songId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}" from the church library?`)) return;

    setActionLoadingId(songId);
    try {
      const res = await adminDeleteSong(songId);
      if (res.error) throw new Error(res.error);

      setSongs((prev) => prev.filter((s) => s.id !== songId));
      toast.success('Song deleted successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete song');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream pb-32">
      {/* Top Header Bar */}
      <div className="border-b-4 border-brand-black bg-brand-cream sticky top-16 z-20">
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="editorial-heading text-2xl sm:text-3xl text-brand-blue">
              SONG MANAGEMENT
            </h1>
            <p className="text-xs uppercase tracking-widest text-brand-black/70 font-bold">
              Church Song Catalog & Dynamic AI Tagging Pipeline
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/songs/search"
              className="inline-flex items-center gap-1.5 bg-brand-pink text-brand-white font-black px-3 py-1.5 text-xs border-2 border-brand-black shadow-[2px_2px_0_0_#111111] hover:bg-brand-pink/90 hover:-translate-y-0.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 fill-brand-white" />
              AI Search Playground
            </Link>
            <span className="bg-brand-yellow text-brand-black font-bold px-3 py-1.5 text-xs border-2 border-brand-black shadow-[2px_2px_0_0_#111111]">
              Catalog: {songs.length} Songs
            </span>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* SECTION 1: UPLOAD & PREVIEW */}
        <section className="bg-brand-white border-4 border-brand-black p-6 shadow-[6px_6px_0_0_#111111] space-y-6">
          <div className="flex items-center gap-3 border-b-2 border-brand-black pb-3">
            <UploadCloud className="w-6 h-6 text-brand-blue" />
            <h2 className="editorial-heading text-xl text-brand-black">
              1. IMPORT SONGS FROM .DOCX
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* File input & options */}
            <div className="md:col-span-2 space-y-4">
              <div className="border-2 border-dashed border-brand-black/40 hover:border-brand-blue p-6 text-center bg-brand-cream/40 transition-colors">
                <FileText className="w-10 h-10 mx-auto mb-2 text-brand-blue/80" />
                <label className="cursor-pointer font-bold text-brand-blue hover:underline">
                  <span>Click to select Word document (.docx)</span>
                  <input
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                {selectedFile ? (
                  <p className="mt-2 text-sm font-bold text-brand-black bg-brand-white border-2 border-brand-black p-2 inline-block">
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                ) : (
                  <p className="text-xs text-brand-black/60 mt-1">
                    Upload 1 song per file, or multiple songs separated by &apos;----&apos;
                  </p>
                )}
              </div>

              {/* Dynamic Single-Select Song Type with Edit Toggle */}
              <div className="bg-brand-cream border-2 border-brand-black p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-brand-black flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-brand-blue" /> Select Song Type (Single Choice):
                  </span>
                  
                  {/* Edit Types Button */}
                  <button
                    type="button"
                    onClick={() => setIsEditingTypes(!isEditingTypes)}
                    className={`text-xs font-bold px-2.5 py-1 border-2 border-brand-black flex items-center gap-1 transition-all ${
                      isEditingTypes
                        ? 'bg-brand-black text-brand-white shadow-[2px_2px_0_0_#FF2E93]'
                        : 'bg-brand-white text-brand-black hover:bg-black/5 shadow-[2px_2px_0_0_#111111]'
                    }`}
                  >
                    <Edit2 className="w-3 h-3" />
                    {isEditingTypes ? 'Done Editing' : 'Edit Types'}
                  </button>
                </div>

                {isEditingTypes && (
                  <div className="bg-amber-50 border border-amber-300 p-2 text-xs text-amber-900 font-bold flex items-center gap-1.5">
                    <span>Edit Mode: click (x) to delete a type, or add a new one on the right.</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {availableTypes.map((type) => {
                    const isSelected = defaultSelectedType === type.slug;
                    return (
                      <div key={type.id} className="relative inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => selectDefaultType(type.slug)}
                          className={`text-xs font-bold px-3 py-1 border-2 transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-brand-blue text-brand-white border-brand-black shadow-[2px_2px_0_0_#111111]'
                              : 'bg-brand-white text-brand-black border-brand-black/40 hover:border-brand-black'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-brand-white" />}
                          {type.name}
                        </button>

                        {/* Delete 'x' Button in Edit Mode */}
                        {isEditingTypes && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSongType(type.id, type.name, type.slug);
                            }}
                            className="ml-1 bg-red-600 text-brand-white hover:bg-red-700 p-1 border border-brand-black text-[10px] font-bold"
                            title={`Delete ${type.name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Add New Type Input (Only visible when Edit Types is active) */}
                  {isEditingTypes && (
                    <div className="inline-flex items-center gap-1 bg-brand-white border-2 border-brand-black p-0.5 shadow-[2px_2px_0_0_#111111]">
                      <input
                        type="text"
                        placeholder="Add new type..."
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateNewType()}
                        className="text-xs px-2 py-0.5 font-bold outline-none w-32"
                        autoFocus
                      />
                      <button
                        type="button"
                        disabled={isSubmittingType || !newTypeName.trim()}
                        onClick={handleCreateNewType}
                        className="bg-brand-pink text-brand-white text-xs px-2 py-0.5 font-bold hover:bg-pink-600 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Card */}
            <div className="bg-brand-cream/60 border-2 border-brand-black p-4 space-y-4 text-center">
              <h3 className="font-bold text-sm uppercase tracking-wider text-brand-black">
                Review & Ingestion Policy
              </h3>
              <p className="text-xs text-brand-black/70 leading-relaxed text-left">
                All newly imported songs <strong>strictly start in Pending Review</strong>. Only approved songs appear in AI recommendation results.
              </p>
              <Button
                variant="primary"
                className="w-full shadow-[3px_3px_0_0_#111111]"
                disabled={!selectedFile || isUploading}
                onClick={handleUploadAndPreview}
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Parsing document...
                  </span>
                ) : (
                  'Upload & Preview'
                )}
              </Button>
            </div>
          </div>

          {/* PREVIEW CONTAINER */}
          {previewData && (
            <div className="mt-8 border-4 border-brand-blue bg-blue-50/50 p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-brand-blue pb-4">
                <div>
                  <h3 className="editorial-heading text-lg text-brand-blue">
                    PARSED PREVIEW ({previewData.summary.total_detected} SONGS DETECTED)
                  </h3>
                  <p className="text-xs font-mono text-brand-black/70 mt-1">
                    SHA-256 Hash: {previewData.file_hash.substring(0, 16)}...
                    {previewData.is_duplicate_file && (
                      <span className="ml-2 font-bold text-red-600 bg-red-100 px-2 py-0.5 border border-red-500">
                        Notice: This exact file was imported previously!
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewData(null)}
                    disabled={isConfirming}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    size="default"
                    className="shadow-[4px_4px_0_0_#111111]"
                    onClick={handleConfirmImport}
                    disabled={isConfirming}
                  >
                    {isConfirming ? (
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" /> Saving to Database...
                      </span>
                    ) : (
                      'Confirm Import to Library (Pending Review)'
                    )}
                  </Button>
                </div>
              </div>

              {/* List of Parsed Songs in Preview */}
              <div className="space-y-4">
                {previewData.songs.map((song, idx) => {
                  const isExpanded = !!expandedSections[idx];
                  const currentSelectedType = (song.types && song.types[0]) || song.song_type || 'worship';

                  return (
                    <div
                      key={idx}
                      className="bg-brand-white border-2 border-brand-black p-4 shadow-[3px_3px_0_0_#111111] space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-black/20 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-brand-black text-brand-white text-xs font-bold px-2 py-0.5">
                            #{idx + 1}
                          </span>
                          <span className="bg-amber-100 text-amber-800 border border-amber-600 text-xs font-bold px-2 py-0.5">
                            PENDING REVIEW
                          </span>
                        </div>

                        {/* Single-select Type Pill for Preview Song */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-black/70 mr-1">
                            Type:
                          </span>
                          {availableTypes.map((type) => {
                            const isAssigned = currentSelectedType === type.slug;
                            return (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => selectPreviewSongType(idx, type.slug)}
                                className={`px-2.5 py-0.5 text-xs font-bold border transition-colors flex items-center gap-1 ${
                                  isAssigned
                                    ? 'bg-brand-blue text-brand-white border-brand-black shadow-[2px_2px_0_0_#111111]'
                                    : 'bg-brand-cream border-brand-black/30 text-brand-black/60 hover:text-brand-black'
                                }`}
                              >
                                {isAssigned && <Check className="w-3 h-3 text-brand-white" />}
                                {type.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Warnings if any */}
                      {song.warnings.length > 0 && (
                        <div className="bg-amber-50 border-l-4 border-amber-500 p-2 space-y-1 text-xs">
                          {song.warnings.map((w, wIdx) => (
                            <div key={wIdx} className="flex items-center gap-1.5 text-amber-900 font-bold">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                              <span>[{w.type}] {w.message}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Song Title and Artist editable in preview */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-brand-black/60 block mb-1 uppercase tracking-wider">
                            Song Title (Editable)
                          </label>
                          <input
                            type="text"
                            value={song.display_title}
                            onChange={(e) => updatePreviewSongTitle(idx, e.target.value)}
                            className="w-full bg-brand-cream/50 border border-brand-black px-3 py-1.5 font-bold text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-brand-black/60 block mb-1 uppercase tracking-wider">
                            Artist / Ministry (Editable)
                          </label>
                          <input
                            type="text"
                            value={song.ministry_or_artist || ''}
                            placeholder="Unknown artist"
                            onChange={(e) => updatePreviewSongArtist(idx, e.target.value)}
                            className="w-full bg-brand-cream/50 border border-brand-black px-3 py-1.5 text-sm"
                          />
                        </div>
                      </div>

                      {/* Sections breakdown & lyrics toggle */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap gap-1.5">
                          {song.sections.map((sec, sIdx) => (
                            <span
                              key={sIdx}
                              className={`text-xs px-2 py-0.5 border ${
                                sec.is_recognized
                                  ? 'bg-brand-cream border-brand-black/40 font-mono'
                                  : 'bg-red-50 text-red-700 border-red-300 font-bold'
                              }`}
                            >
                              {sec.section_label}
                            </span>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSections((prev) => ({ ...prev, [idx]: !prev[idx] }))
                          }
                          className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <>
                              Hide Lyrics <ChevronUp className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              View {song.sections.length} Sections <ChevronDown className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Lyrics accordion */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-brand-black/20 space-y-3 bg-brand-cream/30 p-3">
                          {song.sections.map((sec, sIdx) => (
                            <div key={sIdx} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-brand-blue">
                                  #{sec.section_order} {sec.section_label} ({sec.section_type})
                                </span>
                              </div>
                              <pre className="text-xs font-sans whitespace-pre-wrap bg-brand-white border border-brand-black/20 p-2 rounded text-brand-black">
                                {sec.lyrics_text}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* SECTION 2: SONG CATALOG TABLE */}
        <section className="bg-brand-white border-4 border-brand-black p-6 shadow-[6px_6px_0_0_#111111] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-brand-black pb-3">
            <div className="flex items-center gap-3">
              <Music className="w-6 h-6 text-brand-pink" />
              <h2 className="editorial-heading text-xl text-brand-black">
                2. CHURCH SONG CATALOG ({filteredSongs.length})
              </h2>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Status Filter */}
              <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider border-2 border-brand-black p-0.5 bg-brand-cream">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 ${statusFilter === 'ALL' ? 'bg-brand-black text-brand-white' : ''}`}
                >
                  All ({songs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('APPROVED')}
                  className={`px-2.5 py-1 ${statusFilter === 'APPROVED' ? 'bg-green-600 text-brand-white' : ''}`}
                >
                  Approved ({songs.filter((s) => s.approval_status === 'approved').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('PENDING')}
                  className={`px-2.5 py-1 ${statusFilter === 'PENDING' ? 'bg-amber-500 text-brand-white' : ''}`}
                >
                  Pending ({songs.filter((s) => s.approval_status === 'pending_review').length})
                </button>
              </div>

              {/* Tag / Type Filter */}
              <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider border-2 border-brand-black p-0.5 bg-brand-cream">
                <button
                  type="button"
                  onClick={() => setSelectedTypeFilter('ALL')}
                  className={`px-2.5 py-1 ${selectedTypeFilter === 'ALL' ? 'bg-brand-black text-brand-white' : ''}`}
                >
                  All Types
                </button>
                {availableTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedTypeFilter(type.slug)}
                    className={`px-2.5 py-1 ${selectedTypeFilter === type.slug ? 'bg-brand-blue text-brand-white' : ''}`}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-brand-black/50" />
            <input
              type="text"
              placeholder="Search by title, artist, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-brand-cream/50 border-2 border-brand-black font-bold text-sm placeholder:text-brand-black/40 focus:outline-none focus:border-brand-blue"
            />
          </div>

          {/* Songs Table */}
          <div className="overflow-x-auto border-2 border-brand-black">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-black text-brand-white text-xs font-bold uppercase tracking-wider">
                  <th className="p-3 border-r border-brand-white/20">Song Title</th>
                  <th className="p-3 border-r border-brand-white/20">Artist / Ministry</th>
                  <th className="p-3 border-r border-brand-white/20">Type (Click to switch)</th>
                  <th className="p-3 border-r border-brand-white/20 text-center">Sections</th>
                  <th className="p-3 border-r border-brand-white/20 text-center">Status</th>
                  <th className="p-3 text-center">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium divide-y-2 divide-brand-black/20" suppressHydrationWarning>
                {!mounted ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-brand-black/60 italic font-bold">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-brand-blue" />
                        <span>Loading song catalog...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSongs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-brand-black/60 italic font-bold">
                      No songs found. Upload a .docx file above to populate the library.
                    </td>
                  </tr>
                ) : (
                  filteredSongs.map((song) => {
                    const isRowBusy = actionLoadingId?.startsWith(song.id);
                    const currentType = (song.types && song.types[0]) || song.song_type || 'worship';

                    return (
                      <tr key={song.id} className="hover:bg-brand-cream/40 transition-colors">
                        <td className="p-3 border-r border-brand-black/20 font-bold text-brand-black">
                          {song.display_title}
                          <span className="block text-xs font-mono text-brand-black/50">
                            {song.canonical_title}
                          </span>
                        </td>
                        <td className="p-3 border-r border-brand-black/20 text-brand-black/80">
                          {song.ministry_or_artist || (
                            <span className="text-xs text-brand-black/40 italic">Unknown</span>
                          )}
                        </td>
                        {/* Single-select Type Selector in Table: clicking switches to that type */}
                        <td className="p-3 border-r border-brand-black/20">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {availableTypes.map((type) => {
                              const isAssigned = currentType === type.slug;
                              return (
                                <button
                                  key={type.id}
                                  type="button"
                                  suppressHydrationWarning
                                  disabled={isRowBusy}
                                  onClick={() => handleSelectSongType(song.id, type.slug)}
                                  title={`Click to set type to ${type.name}`}
                                  className={`text-xs font-bold px-2 py-0.5 border transition-all flex items-center gap-1 ${
                                    isAssigned
                                      ? 'bg-blue-100 text-blue-800 border-blue-500 shadow-[1px_1px_0_0_#111111]'
                                      : 'bg-brand-cream/50 text-brand-black/40 border-brand-black/20 hover:border-brand-black hover:text-brand-black'
                                  }`}
                                >
                                  {isAssigned && <Check className="w-2.5 h-2.5 text-blue-600" />}
                                  {type.name}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="p-3 border-r border-brand-black/20 text-center font-mono text-xs">
                          {song.section_count} sections
                        </td>
                        {/* Approval Status Badge */}
                        <td className="p-3 border-r border-brand-black/20 text-center">
                          <span
                            className={`inline-block text-xs font-bold px-2.5 py-0.5 border ${
                              song.approval_status === 'approved'
                                ? 'bg-green-100 text-green-800 border-green-600'
                                : 'bg-amber-100 text-amber-800 border-amber-600'
                            }`}
                          >
                            {song.approval_status === 'approved' ? 'APPROVED' : 'PENDING'}
                          </span>
                        </td>
                        {/* Admin Action Buttons */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              suppressHydrationWarning
                              disabled={isRowBusy}
                              onClick={() => handleToggleApproval(song.id, song.approval_status)}
                              className={`text-xs font-bold px-2.5 py-1 border flex items-center gap-1 transition-transform active:scale-95 ${
                                song.approval_status === 'approved'
                                  ? 'bg-amber-50 text-amber-800 border-amber-600 hover:bg-amber-100'
                                  : 'bg-green-600 text-brand-white border-green-800 hover:bg-green-700'
                              }`}
                            >
                              {song.approval_status === 'approved' ? (
                                <>
                                  <X className="w-3 h-3" /> Unapprove
                                </>
                              ) : (
                                <>
                                  <Check className="w-3 h-3" /> Approve
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              suppressHydrationWarning
                              disabled={isRowBusy}
                              onClick={() => handleDeleteSong(song.id, song.display_title)}
                              className="p-1 text-red-600 hover:text-red-800 border border-transparent hover:border-red-400"
                              title="Delete song"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 3: RECENT IMPORTS AUDIT */}
        {recentImports.length > 0 && (
          <section className="bg-brand-white border-4 border-brand-black p-6 shadow-[6px_6px_0_0_#111111] space-y-4">
            <h3 className="editorial-heading text-lg text-brand-black">
              RECENT IMPORT HISTORY (AUDIT TRAIL)
            </h3>
            <div className="overflow-x-auto border-2 border-brand-black text-xs font-mono">
              <table className="w-full text-left">
                <thead className="bg-brand-cream border-b border-brand-black font-bold">
                  <tr>
                    <th className="p-2 border-r border-brand-black/20">File Name</th>
                    <th className="p-2 border-r border-brand-black/20 text-center">Status</th>
                    <th className="p-2 border-r border-brand-black/20 text-center">Detected</th>
                    <th className="p-2 border-r border-brand-black/20 text-center">Imported</th>
                    <th className="p-2 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-black/20">
                  {recentImports.map((imp) => (
                    <tr key={imp.id}>
                      <td className="p-2 border-r border-brand-black/20 font-bold">{imp.file_name}</td>
                      <td className="p-2 border-r border-brand-black/20 text-center uppercase font-bold text-brand-blue">
                        {imp.status}
                      </td>
                      <td className="p-2 border-r border-brand-black/20 text-center">{imp.detected_count}</td>
                      <td className="p-2 border-r border-brand-black/20 text-center font-bold text-green-700">
                        {imp.imported_count}
                      </td>
                      <td className="p-2 text-right text-brand-black/60 font-mono text-xs" suppressHydrationWarning>
                        {mounted && imp.created_at ? new Date(imp.created_at).toLocaleString() : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
