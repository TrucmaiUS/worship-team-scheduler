'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Cpu, 
  Layers, 
  ArrowLeft, 
  Filter, 
  BookOpen, 
  CheckCircle, 
  Music,
  ChevronRight,
  ChevronDown,
  X,
  HelpCircle,
  TrendingUp,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { SongSearchResult } from '@/lib/search/types';

export default function SearchPlaygroundClient() {
  const [query, setQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'comparison' | 'hybrid' | 'semantic' | 'keyword'>('hybrid');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'praise' | 'worship'>('all');
  const [limit, setLimit] = useState<number>(10);
  const [isLoading, setIsLoading] = useState(false);

  // Result sets
  const [keywordResults, setKeywordResults] = useState<SongSearchResult[]>([]);
  const [semanticResults, setSemanticResults] = useState<SongSearchResult[]>([]);
  const [hybridResults, setHybridResults] = useState<SongSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const sampleQueries = [
    'Mạng lệnh môn đồ hóa',
    'Thập tự giá & Hy sinh',
    'Ngợi khen tôn vinh Danh Chúa',
    'Bình an trong giông bão',
    'Ân điển cứu chuộc',
    'A Thousand Hallelujahs',
  ];

  const handleSearch = async (targetQuery?: string) => {
    const q = (targetQuery !== undefined ? targetQuery : query).trim();
    if (!q) {
      toast.error('Please enter a sermon topic, scripture, or lyric keywords');
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const baseParams = new URLSearchParams({
        q,
        status: statusFilter,
        type: typeFilter,
        limit: limit.toString(),
      });

      if (selectedMethod === 'comparison') {
        // Fetch all 3 concurrently
        const [kwRes, semRes, hybRes] = await Promise.all([
          fetch(`/api/songs/search?${baseParams.toString()}&method=keyword`).then((r) => r.json()),
          fetch(`/api/songs/search?${baseParams.toString()}&method=semantic`).then((r) => r.json()),
          fetch(`/api/songs/search?${baseParams.toString()}&method=hybrid`).then((r) => r.json()),
        ]);

        if (kwRes.success) setKeywordResults(kwRes.results || []);
        if (semRes.success) setSemanticResults(semRes.results || []);
        if (hybRes.success) setHybridResults(hybRes.results || []);
      } else {
        const res = await fetch(`/api/songs/search?${baseParams.toString()}&method=${selectedMethod}`).then((r) => r.json());
        if (res.success) {
          if (selectedMethod === 'keyword') setKeywordResults(res.results || []);
          if (selectedMethod === 'semantic') setSemanticResults(res.results || []);
          if (selectedMethod === 'hybrid') setHybridResults(res.results || []);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Error executing search');
    } finally {
      setIsLoading(false);
    }
  };

  const renderSongCard = (song: SongSearchResult, method: 'keyword' | 'semantic' | 'hybrid') => {
    return (
      <div
        key={`${method}-${song.song_id}-${song.rank}`}
        className="bg-brand-white border-2 border-brand-black p-4 shadow-[3px_3px_0_0_#111111] hover:-translate-y-0.5 transition-transform"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 flex items-center justify-center bg-brand-black text-brand-white text-xs font-black rounded-none">
              #{song.rank}
            </span>
            <h4 className="font-black text-brand-blue text-sm line-clamp-1">
              {song.display_title}
            </h4>
          </div>
          <span className={`text-[10px] font-black px-2 py-0.5 uppercase border border-brand-black shadow-[1px_1px_0_0_#111111] ${
            (song.song_type || '').toLowerCase() === 'praise'
              ? 'bg-brand-pink text-brand-white'
              : 'bg-brand-blue text-brand-white'
          }`}>
            {song.song_type || 'worship'}
          </span>
        </div>

        {song.ministry_or_artist && (
          <p className="text-xs text-brand-black/70 mb-2 italic">
            By {song.ministry_or_artist}
          </p>
        )}

        {/* Retrieval Score & Details - Clean, Simple Styling */}
        <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] font-mono">
          {method === 'keyword' && (
            <span className="bg-brand-cream px-2 py-0.5 border border-brand-black text-brand-black">
              BM25 / ts_rank: <strong className="font-bold">{song.score.toFixed(4)}</strong>
            </span>
          )}

          {method === 'semantic' && (
            <span className="bg-brand-cream px-2 py-0.5 border border-brand-black text-brand-black">
              Cosine Sim: <strong className="font-bold">{(song.score * 100).toFixed(1)}%</strong>
            </span>
          )}

          {method === 'hybrid' && (
            <>
              <span className="bg-brand-cream text-brand-black px-2 py-0.5 border border-brand-black font-bold">
                RRF Score: {song.score.toFixed(5)}
              </span>
              {song.keyword_score !== undefined && (
                <span className="bg-brand-cream text-brand-black px-1.5 py-0.5 border border-brand-black">
                  KW: {song.keyword_score.toFixed(3)}
                </span>
              )}
              {song.semantic_score !== undefined && (
                <span className="bg-brand-cream text-brand-black px-1.5 py-0.5 border border-brand-black">
                  SEM: {(song.semantic_score * 100).toFixed(0)}%
                </span>
              )}
            </>
          )}
        </div>

        {/* Explainable Evidence */}
        {song.matched_evidence ? (
          <div className="bg-brand-cream/80 border-l-4 border-brand-blue p-2.5 text-xs text-brand-black">
            <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] text-brand-blue mb-1">
              <FileText className="w-3 h-3" />
              <span>Matched {song.matched_evidence.section_label}</span>
            </div>
            <p className="font-sans font-medium whitespace-pre-line text-brand-black/85 text-xs leading-relaxed line-clamp-3">
              "{song.matched_evidence.lyrics_snippet?.normalize('NFC')}"
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 border border-dashed border-gray-300 p-2 text-[11px] text-gray-500 italic">
            Matched via song title / artist metadata
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-brand-cream pb-32">
      {/* Top Header Bar */}
      <div className="border-b-4 border-brand-black bg-brand-cream sticky top-16 z-20">
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Link 
                href="/admin/songs"
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-black hover:text-brand-blue transition-colors uppercase"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Song Management
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-xs uppercase tracking-widest text-brand-black/70 font-bold">
                Search Engine
              </span>
            </div>
            <h1 className="editorial-heading text-2xl sm:text-3xl text-brand-blue mt-1 flex items-center gap-2">
              AI SEARCH & RETRIEVAL PLAYGROUND
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/songs/setlist"
              className="bg-brand-pink text-brand-white border-2 border-brand-black px-3.5 py-1.5 text-xs font-black shadow-[2px_2px_0_0_#111111] hover:-translate-y-0.5 transition-transform uppercase flex items-center gap-1.5"
            >
              AI Setlist Generator
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Main Search Console */}
        <div className="bg-brand-white border-4 border-brand-black p-5 sm:p-6 shadow-[6px_6px_0_0_#111111] mb-8">
          {/* Header & Instructions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3.5">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-brand-black flex items-center gap-1.5">
                Sermon Topic, Scripture Text, or Liturgical Theme
              </h2>
              <p className="text-[11px] text-brand-black/60 font-medium">
                Matches theological concepts across 67 songs and 311 lyric sections
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold bg-brand-cream border border-brand-black px-2 py-0.5 text-brand-black/70 self-start sm:self-auto shadow-[1px_1px_0_0_#111111]">
              Press Enter ↵ to search
            </span>
          </div>

          {/* Unified Input + Button Console */}
          <div className="relative flex flex-col sm:flex-row border-2 border-brand-black shadow-[4px_4px_0_0_#111111] bg-brand-cream mb-4 focus-within:ring-2 focus-within:ring-brand-blue">
            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-brand-black/40 ml-3.5 mr-1 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. Mạng lệnh môn đồ hóa, Sự tha thứ và tình yêu thập tự giá (Giăng 3:16)"
                className="w-full bg-transparent px-2.5 py-3.5 text-sm font-bold text-brand-black focus:outline-none placeholder:text-brand-black/40 placeholder:font-normal"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 mr-2 text-brand-black/40 hover:text-brand-black cursor-pointer"
                  title="Clear"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleSearch()}
              disabled={isLoading}
              className="bg-brand-blue text-brand-white font-black px-7 py-3.5 sm:border-l-2 border-t-2 sm:border-t-0 border-brand-black hover:bg-brand-blue/90 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 text-xs uppercase tracking-wider shrink-0 disabled:opacity-70"
            >
              {isLoading ? (
                <span>Searching...</span>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Run AI Retrieval</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Example Suggestions (Single Row) */}
          <div className="flex flex-wrap items-center gap-1.5 mb-5">
            <span className="text-[11px] font-black uppercase tracking-wider text-brand-black/50 mr-1 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" /> Examples:
            </span>
            {sampleQueries.map((sq) => (
              <button
                key={sq}
                type="button"
                onClick={() => {
                  setQuery(sq);
                  handleSearch(sq);
                }}
                className="text-xs bg-brand-cream hover:bg-brand-black hover:text-brand-white font-bold text-brand-black px-2.5 py-1 border border-brand-black transition-colors cursor-pointer shadow-[1px_1px_0_0_#111111] active:scale-95"
              >
                {sq}
              </button>
            ))}
          </div>

          {/* Configuration Toolbar */}
          <div className="pt-3.5 border-t-2 border-brand-black/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 sm:gap-5">
              {/* Mode Select */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase text-brand-black/70">Mode:</span>
                <div className="relative">
                  <select
                    value={selectedMethod}
                    onChange={(e: any) => setSelectedMethod(e.target.value)}
                    className="appearance-none bg-brand-white border border-brand-black pl-2.5 pr-7 py-1 text-xs font-bold text-brand-black cursor-pointer shadow-[1px_1px_0_0_#111111] focus:outline-none"
                  >
                    <option value="comparison">3-Way Comparison</option>
                    <option value="hybrid">Hybrid Search (Default)</option>
                    <option value="semantic">Vector Search (Semantic)</option>
                    <option value="keyword">Keyword Search (FTS)</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-brand-black absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase text-brand-black/70">Type:</span>
                <div className="relative">
                  <select
                    value={typeFilter}
                    onChange={(e: any) => setTypeFilter(e.target.value)}
                    className="appearance-none bg-brand-white border border-brand-black pl-2.5 pr-7 py-1 text-xs font-bold text-brand-black cursor-pointer shadow-[1px_1px_0_0_#111111] focus:outline-none"
                  >
                    <option value="all">All Types</option>
                    <option value="praise">Praise</option>
                    <option value="worship">Worship</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-brand-black absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Catalog Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase text-brand-black/70">Catalog:</span>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="appearance-none bg-brand-white border border-brand-black pl-2.5 pr-7 py-1 text-xs font-bold text-brand-black cursor-pointer shadow-[1px_1px_0_0_#111111] focus:outline-none"
                  >
                    <option value="all">All Songs (67)</option>
                    <option value="approved">Approved Only</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-brand-black absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Limit Segmented Control */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase text-brand-black/70">Limit:</span>
              <div className="flex border border-brand-black bg-brand-white shadow-[1px_1px_0_0_#111111]">
                {[5, 10, 15].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLimit(l)}
                    className={`px-3 py-1 text-xs font-black transition-colors ${
                      limit === l
                        ? 'bg-brand-black text-brand-white'
                        : 'text-brand-black hover:bg-brand-cream'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results Sections */}
        {hasSearched ? (
          <div>
            {selectedMethod === 'comparison' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Baseline 1 Keyword */}
                <div className="flex flex-col">
                  <div className="bg-brand-black text-brand-white p-3.5 border-2 border-brand-black shadow-[3px_3px_0_0_#111111] mb-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-sm uppercase tracking-wide">Baseline 1: Keyword FTS</h3>
                      <span className="text-xs font-mono font-bold bg-brand-white text-brand-black px-2 py-0.5 border border-brand-black">
                        {keywordResults.length} matches
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-white/70 mt-1">
                      PostgreSQL ts_rank_cd with unaccent dictionary matching exact phrases in titles & lyrics.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {keywordResults.length === 0 ? (
                      <div className="p-6 text-center bg-brand-white border-2 border-brand-black text-xs text-brand-black/60 italic">
                        No keyword matches found. Keyword search requires exact lexical term overlap.
                      </div>
                    ) : (
                      keywordResults.map((song) => renderSongCard(song, 'keyword'))
                    )}
                  </div>
                </div>

                {/* Column 2: Baseline 2 Semantic */}
                <div className="flex flex-col">
                  <div className="bg-brand-black text-brand-white p-3.5 border-2 border-brand-black shadow-[3px_3px_0_0_#111111] mb-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-sm uppercase tracking-wide">Baseline 2: Semantic Vector</h3>
                      <span className="text-xs font-mono font-bold bg-brand-white text-brand-black px-2 py-0.5 border border-brand-black">
                        {semanticResults.length} matches
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-white/70 mt-1">
                      pgvector cosine similarity matching conceptual intent across 768-d semantic representations.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {semanticResults.length === 0 ? (
                      <div className="p-6 text-center bg-brand-white border-2 border-brand-black text-xs text-brand-black/60 italic">
                        No vector matches found.
                      </div>
                    ) : (
                      semanticResults.map((song) => renderSongCard(song, 'semantic'))
                    )}
                  </div>
                </div>

                {/* Column 3: Baseline 3 Hybrid RRF */}
                <div className="flex flex-col">
                  <div className="bg-brand-black text-brand-white p-3.5 border-2 border-brand-black shadow-[3px_3px_0_0_#111111] mb-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-sm uppercase tracking-wide">Baseline 3: Hybrid RRF</h3>
                      <span className="text-xs font-mono font-bold bg-brand-white text-brand-black px-2 py-0.5 border border-brand-black">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-white/70 mt-1">
                      Reciprocal Rank Fusion combines keyword precision + vector recall with standard k=60 smoothing.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {hybridResults.length === 0 ? (
                      <div className="p-6 text-center bg-brand-white border-2 border-brand-black text-xs text-brand-black/60 italic">
                        No hybrid results found.
                      </div>
                    ) : (
                      hybridResults.map((song) => renderSongCard(song, 'hybrid'))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Single View */
              <div className="max-w-3xl mx-auto space-y-4">
                <h3 className="font-black text-lg text-brand-blue uppercase flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-brand-pink" />
                  Top Ranked Recommendations ({selectedMethod.toUpperCase()})
                </h3>
                {(selectedMethod === 'keyword'
                  ? keywordResults
                  : selectedMethod === 'semantic'
                  ? semanticResults
                  : hybridResults
                ).map((song) => renderSongCard(song, selectedMethod))}
              </div>
            )}
          </div>
        ) : (
          /* Empty State / Welcome Guide */
          <div className="bg-brand-white border-4 border-brand-black p-8 text-center shadow-[6px_6px_0_0_#111111]">
            <h3 className="editorial-heading text-2xl text-brand-blue mb-2">
              Explore AI Song Retrieval
            </h3>
            <p className="text-sm text-brand-black/70 max-w-xl mx-auto mb-6">
              Enter any sermon topic, scripture passage, or spiritual theme above to test and compare how our 3 search baselines retrieve and rank the church's 67 song catalog in real time.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto text-left">
              <div className="bg-brand-cream border-2 border-brand-black p-4">
                <div className="font-black text-xs uppercase mb-1 text-brand-blue">Baseline 1: Keyword FTS</div>
                <p className="text-[11px] text-brand-black/80">
                  Exact term & lemma matching using PostgreSQL GIN index with unaccented Vietnamese support.
                </p>
              </div>
              <div className="bg-brand-cream border-2 border-brand-black p-4">
                <div className="font-black text-xs uppercase mb-1 text-brand-blue">Baseline 2: Semantic Vector</div>
                <p className="text-[11px] text-brand-black/80">
                  Matches underlying meaning & theological concepts using 768-dimensional embeddings and cosine distance.
                </p>
              </div>
              <div className="bg-brand-cream border-2 border-brand-black p-4">
                <div className="font-black text-xs uppercase mb-1 text-brand-blue">Baseline 3: Hybrid RRF</div>
                <p className="text-[11px] text-brand-black/80">
                  Combines the strengths of both algorithms via Reciprocal Rank Fusion for optimal recall and precision.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
