'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { GeneratedSetlistResponse } from '@/lib/ai/setlist-generator';

export default function SetlistGeneratorClient() {
  const [theme, setTheme] = useState('Sự tha thứ & Yêu thương kẻ thù');
  const [scripture, setScripture] = useState('Ma-thi-ơ 5:43-48');
  const [isLoading, setIsLoading] = useState(false);
  const [setlist, setSetlist] = useState<GeneratedSetlistResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const samplePresets = [
    {
      theme: 'Sự tha thứ & Yêu thương kẻ thù',
      scripture: 'Ma-thi-ơ 5:43-48',
    },
    {
      theme: 'Vượt qua trũng bóng tối & Gian truân',
      scripture: 'Thi Thiên 23:4',
    },
    {
      theme: 'Đức Thánh Linh & Sự đổi mới tâm linh',
      scripture: 'Công vụ 2:1-4',
    },
    {
      theme: 'Thập tự giá & Tình yêu cứu chuộc',
      scripture: 'Giăng 3:16',
    },
    {
      theme: 'Lòng biết ơn & Tạ ơn Chúa trọn vẹn',
      scripture: 'Thi Thiên 100',
    },
  ];

  const handleGenerate = async () => {
    if (!theme.trim()) {
      toast.error('Vui lòng nhập chủ đề bài giảng.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/songs/setlist/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: theme.trim(),
          scriptureReference: scripture.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi khi tạo kịch bản thờ phượng');
      }

      setSetlist(data.data);
      toast.success('Đã tạo kịch bản thờ phượng thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Đã sao chép vào bộ nhớ tạm!');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const copyFullSetlist = () => {
    if (!setlist) return;

    let fullText = `=== KỊCH BẢN THỜ PHƯỢNG CHÚA NHẬT ===\n`;
    fullText += `Chủ đề: ${setlist.theme}\n`;
    if (setlist.scripture_reference) fullText += `Phân đoạn: ${setlist.scripture_reference}\n\n`;
    fullText += `TỔNG QUAN PHỤNG VỤ:\n${setlist.overview}\n\n`;

    setlist.songs.forEach((s, idx) => {
      fullText += `[BÀI ${idx + 1}: ${s.position_label.toUpperCase()}]\n`;
      fullText += `${s.song_title} (${s.artist || 'N/A'})\n`;
      fullText += `Ý nghĩa: ${s.liturgical_reasoning}\n\n`;

      if (idx < setlist.transitions.length) {
        const t = setlist.transitions[idx];
        fullText += `--- LỜI DẪN NHẬP (${t.from_song_title} -> ${t.to_song_title}) ---\n`;
        fullText += `"${t.prayer_script}"\n`;
        fullText += `[Gợi ý ban nhạc]: ${t.musical_tip}\n\n`;
      }
    });

    fullText += `--- CẦU NGUYỆN KẾT THÚC ---\n"${setlist.closing_prayer}"\n`;

    copyToClipboard(fullText, 'full_setlist');
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
              <Link
                href="/admin/songs/search"
                className="text-xs uppercase tracking-widest text-brand-black/70 hover:text-brand-blue font-bold"
              >
                Search Playground
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-xs uppercase tracking-widest text-brand-pink font-black">
                Setlist Generator
              </span>
            </div>
            <h1 className="editorial-heading text-2xl sm:text-3xl text-brand-blue mt-1">
              AI SETLIST GENERATOR
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/songs/search"
              className="bg-brand-white border-2 border-brand-black px-3.5 py-1.5 text-xs font-bold text-brand-black shadow-[2px_2px_0_0_#111111] hover:-translate-y-0.5 transition-transform uppercase"
            >
              Universal Search
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Input Configuration Box */}
        <div className="bg-brand-white border-4 border-brand-black p-5 sm:p-7 shadow-[6px_6px_0_0_#111111] mb-8">
          <div className="mb-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-brand-black">
              Cấu hình Kịch bản Thờ phượng (3 bài)
            </h2>
            <p className="text-xs text-brand-black/60 font-medium mt-0.5">
              Tự động truy hồi bài hát phù hợp từ kho và phối thành luồng: Mở đầu → Sâu lắng → Kết thúc kèm lời dẫn nhập.
            </p>
          </div>

          {/* Quick Presets (Clean Pills without icons) */}
          <div className="mb-5">
            <label className="text-[11px] font-black uppercase tracking-wider text-brand-black/60 block mb-2">
              Chủ đề mẫu:
            </label>
            <div className="flex flex-wrap gap-2">
              {samplePresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTheme(preset.theme);
                    setScripture(preset.scripture);
                  }}
                  className={`text-xs font-bold px-3 py-1.5 border-2 border-brand-black transition-all cursor-pointer ${
                    theme === preset.theme
                      ? 'bg-brand-pink text-brand-white shadow-[2px_2px_0_0_#111111] -translate-y-0.5'
                      : 'bg-brand-cream text-brand-black hover:bg-brand-pink/20'
                  }`}
                >
                  {preset.theme}
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-5">
            {/* Theme */}
            <div className="md:col-span-8">
              <label className="text-xs font-black uppercase tracking-wider text-brand-black block mb-1.5">
                Chủ đề Bài giảng / Sứ điệp *
              </label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Ví dụ: Sự tha thứ & Yêu thương kẻ thù"
                className="w-full bg-brand-cream border-2 border-brand-black px-3 py-2.5 text-sm font-bold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0_0_#111111]"
              />
            </div>

            {/* Scripture */}
            <div className="md:col-span-4">
              <label className="text-xs font-black uppercase tracking-wider text-brand-black block mb-1.5">
                Phân đoạn Kinh Thánh (Tùy chọn)
              </label>
              <input
                type="text"
                value={scripture}
                onChange={(e) => setScripture(e.target.value)}
                placeholder="Ví dụ: Ma-thi-ơ 5:43-48"
                className="w-full bg-brand-cream border-2 border-brand-black px-3 py-2.5 text-sm font-bold text-brand-black focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0_0_#111111]"
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-2 border-t-2 border-dashed border-gray-200">
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading || !theme.trim()}
              className="bg-brand-blue text-brand-white hover:bg-blue-700 px-8 py-3 text-sm font-black flex items-center gap-2 shadow-[3px_3px_0_0_#111111] cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang tạo kịch bản...
                </>
              ) : (
                'Tạo Kịch Bản Thờ Phượng'
              )}
            </Button>
          </div>
        </div>

        {/* Generated Setlist Output */}
        {setlist && (
          <div className="space-y-6">
            {/* Overview Header */}
            <div className="bg-brand-blue text-brand-white border-4 border-brand-black p-5 sm:p-6 shadow-[6px_6px_0_0_#111111]">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <span className="bg-brand-pink text-brand-white px-2.5 py-0.5 text-[11px] font-black uppercase border border-brand-black">
                  Kịch Bản 3 Bài
                </span>

                <Button
                  onClick={copyFullSetlist}
                  variant="outline"
                  size="sm"
                  className="bg-brand-white text-brand-black border-2 border-brand-black hover:bg-brand-cream text-xs font-bold"
                >
                  {copiedKey === 'full_setlist' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-600 mr-1" /> Đã Sao Chép
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Sao Chép Toàn Bộ Kịch Bản
                    </>
                  )}
                </Button>
              </div>

              <h2 className="editorial-heading text-xl sm:text-2xl text-brand-white mb-1">
                {setlist.theme} {setlist.scripture_reference && `(${setlist.scripture_reference})`}
              </h2>
              <p className="text-xs sm:text-sm text-brand-white/90 leading-relaxed font-sans font-medium">
                {setlist.overview}
              </p>
            </div>

            {/* Liturgical Flow Arc (3 Songs + 2 Transitions) */}
            <div className="space-y-4">
              {setlist.songs.map((song, idx) => {
                const transitionAfter = setlist.transitions[idx];

                const roleLabels = {
                  opener: '1. BÀI MỞ ĐẦU (CALL TO WORSHIP)',
                  worship: '2. THỜ PHƯỢNG SÂU LẮNG (INTIMATE WORSHIP)',
                  closing: '3. ĐÁP ỨNG KẾT THÚC (RESPONSE & SENDING)',
                };

                return (
                  <div key={song.song_id || idx} className="space-y-4">
                    {/* Song Card */}
                    <div className="bg-brand-white border-4 border-brand-black p-5 shadow-[5px_5px_0_0_#111111]">
                      <div className="mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-brand-cream border border-brand-black px-2 py-0.5 text-brand-black inline-block mb-1.5">
                          {roleLabels[song.position]}
                        </span>
                        <h3 className="editorial-heading text-lg sm:text-xl text-brand-black">
                          {song.song_title}
                        </h3>
                        {song.artist && (
                          <p className="text-xs text-brand-black/60 font-bold uppercase tracking-wider">
                            {song.artist}
                          </p>
                        )}
                      </div>

                      <div className="bg-brand-cream/80 border-l-4 border-brand-blue p-3 text-xs text-brand-black">
                        <div className="font-bold uppercase text-[10px] text-brand-blue mb-0.5">
                          Ý nghĩa phụng vụ:
                        </div>
                        <p className="leading-relaxed font-sans">{song.liturgical_reasoning}</p>
                      </div>
                    </div>

                    {/* Transition Bridge Box */}
                    {transitionAfter && (
                      <div className="bg-brand-pink/10 border-2 border-dashed border-brand-pink p-4 shadow-[3px_3px_0_0_#EE4580] my-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black uppercase tracking-wider text-brand-pink">
                            Lời dẫn nhập: {transitionAfter.from_song_title} ➔ {transitionAfter.to_song_title}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                transitionAfter.prayer_script,
                                `trans_${idx}`
                              )
                            }
                            className="text-[11px] font-bold text-brand-pink hover:text-pink-700 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === `trans_${idx}` ? (
                              <>
                                <Check className="w-3 h-3 text-green-600" /> Đã chép
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" /> Chép lời cầu nguyện
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-xs sm:text-sm text-brand-black font-medium italic leading-relaxed mb-3 bg-white/70 p-3 border border-pink-200">
                          "{transitionAfter.prayer_script}"
                        </p>

                        <div className="text-xs text-brand-black/70">
                          <strong>Gợi ý ban nhạc:</strong> {transitionAfter.musical_tip}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Closing Prayer Card */}
            <div className="bg-brand-white border-4 border-brand-black p-5 sm:p-6 shadow-[5px_5px_0_0_#111111]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-brand-blue">
                  Lời Cầu Nguyện Bế Mạc
                </span>

                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(setlist.closing_prayer, 'closing_prayer')
                  }
                  className="text-xs font-bold text-brand-blue hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'closing_prayer' ? (
                    <>
                      <Check className="w-3 h-3 text-green-600" /> Đã chép
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Chép lời cầu nguyện
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs sm:text-sm text-brand-black font-serif italic leading-relaxed bg-brand-cream/60 p-4 border-2 border-brand-black/10">
                "{setlist.closing_prayer}"
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
