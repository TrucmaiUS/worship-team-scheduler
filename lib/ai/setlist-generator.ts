import { z } from 'zod';
import { searchHybrid } from '../search/hybrid-search';
import { SongSearchResult } from '../search/types';

// ============================================================================
// 1. DATA CONTRACTS & ZOD SCHEMAS
// ============================================================================

export type VocalRange = 'male' | 'female' | 'any';

export interface GenerateSetlistParams {
  theme: string;
  scriptureReference?: string;
  leaderVocalRange?: VocalRange;
  songCount?: number; // Default 3
  notes?: string;
}

export const SetlistSongItemSchema = z.object({
  song_id: z.string().describe('Exact UUID of the song from the candidate database list'),
  song_title: z.string().describe('Exact display title of the song from the candidate list'),
  artist: z.string().optional().describe('Ministry or artist name'),
  position: z.enum(['opener', 'worship', 'closing']).describe('Liturgical position in service'),
  position_label: z.string().describe('Vietnamese label (e.g., Bài mở đầu ngợi khen, Thờ phượng sâu lắng, Bài đáp ứng kết thúc)'),
  recommended_key: z.string().describe('Recommended musical key suitable for the leader vocal range (e.g., G, D, C, A)'),
  tempo_feel: z.enum(['upbeat', 'reflective', 'solemn', 'triumphant']).describe('Rhythm and feel'),
  liturgical_reasoning: z.string().describe('Concise reason in Vietnamese why this song was chosen for this sermon theme and position'),
});

export const TransitionGuideSchema = z.object({
  from_song_title: z.string(),
  to_song_title: z.string(),
  prayer_script: z.string().describe('A sincere 2-3 sentence pastoral transition prayer in Vietnamese connecting the previous song to the next'),
  musical_tip: z.string().describe('Practical tip for the band on transition, chord voicing, or dynamics (e.g. Giữ pad phím G, rải acoustic nhẹ)'),
});

export const GeneratedSetlistResponseSchema = z.object({
  theme: z.string(),
  scripture_reference: z.string().optional(),
  leader_vocal_range: z.enum(['male', 'female', 'any']),
  overview: z.string().describe('A brief pastoral overview of the worship journey designed for this sermon'),
  songs: z.array(SetlistSongItemSchema).length(3).describe('Exactly 3 ordered songs matching the candidate catalog'),
  transitions: z.array(TransitionGuideSchema).length(2).describe('Exactly 2 transitions between song 1->2 and 2->3'),
  closing_prayer: z.string().describe('A closing benediction / prayer summarizing the sermon theme'),
});

export type SetlistSongItem = z.infer<typeof SetlistSongItemSchema>;
export type TransitionGuide = z.infer<typeof TransitionGuideSchema>;
export type GeneratedSetlistResponse = z.infer<typeof GeneratedSetlistResponseSchema>;

// ============================================================================
// 2. RETRIEVAL CANDIDATE POOL PREPARATION
// ============================================================================

interface CandidateSongContext {
  id: string;
  title: string;
  artist: string;
  type: string;
  matched_lyrics_snippet: string;
}

async function retrieveCandidateSongs(theme: string): Promise<CandidateSongContext[]> {
  // Use our SOTA Hybrid RRF search to get top candidates
  const candidates = await searchHybrid(theme, {
    limit: 12,
    eligibilityStatus: 'approved',
    rrfConstant: 60,
  });

  return candidates.map((c) => ({
    id: c.song_id,
    title: c.display_title,
    artist: c.ministry_or_artist || 'Unknown',
    type: c.song_type || (c.types?.[0] ?? 'worship'),
    matched_lyrics_snippet: c.matched_evidence?.lyrics_snippet || '',
  }));
}

// ============================================================================
// 3. LLM GENERATION WITH STRICT JSON SCHEMA CONSTRAINT
// ============================================================================

const SYSTEM_PROMPT = `Bạn là Giám đốc Âm nhạc và Mục sư Thờ phượng Cơ Đốc giàu kinh nghiệm (Christian Worship Director & Liturgical Architect).
Nhiệm vụ của bạn là sắp xếp một Kịch bản Thờ phượng (Worship Setlist) gồm ĐÚNG 3 BÀI HÁT cho buổi lễ Chúa Nhật dựa trên Chủ đề bài giảng và Tone giọng của Trưởng nhóm (Worship Leader).

CÁC NGUYÊN TẮC RÀNG BUỘC TUYỆT ĐỐI (HARD CONSTRAINTS):
1. CHỐNG ẢO GIÁC (ZERO HALLUCINATION): Bạn CHỈ ĐƯỢC PHÉP chọn bài hát từ Danh sách Ứng viên (Candidate Pool) được cung cấp dưới đây. TUYỆT ĐỐI KHÔNG tự sáng tác bài mới, không chọn bài ngoài danh sách. Mỗi 'song_id' và 'song_title' phải khớp 100% với một bài hát trong ứng viên.
2. CẤU TRÚC PHỤNG VỤ 3 BÀI (3-SONG LITURGICAL ARC):
   - Bài 1 (position: 'opener'): Lời kêu gọi thờ phượng (Call to worship / Praise). Vui tươi, hân hoan, tràn đầy năng lượng để mở lòng hội chúng.
   - Bài 2 (position: 'worship'): Thờ phượng sâu lắng (Deep intimate worship / Adoration). Tôn vinh danh Chúa, đưa hội chúng vào nơi chí thánh, chiêm ngưỡng thập tự giá và ân điển Chúa.
   - Bài 3 (position: 'closing'): Đáp ứng bài giảng & Dâng hiến (Response / Dedication / Sending). Cam kết vâng phục, sống theo lẽ thật bài giảng.
3. TONE GIỌNG LEADER:
   - Giọng Nam (male): Đề xuất các tone nam thuận lợi (thường là G, C, D, A, E).
   - Giọng Nữ (female): Đề xuất các tone nữ thuận lợi (thường là C, D, F, Bb, Eb).
4. LỜI CẦU NGUYỆN DẪN NHẬP (TRANSITION PRAYERS):
   - Cung cấp 2 lời cầu nguyện chuyển tiếp (Transition 1->2 và Transition 2->3) bằng tiếng Việt ấm áp, sâu sắc, gắn kết ý nghĩa bài giảng từ ca từ bài trước sang bài sau.
   - Kèm mẹo kỹ thuật chuyển nhịp/chuyển tone (musical_tip) cho ban nhạc.
5. ĐẦU RA PHẢI LÀ JSON HỢP LỆ THEO SCHEMA. Không bọc mã markdown, chỉ trả về JSON thuần túy.`;

async function callGeminiWithCandidates(
  theme: string,
  scripture: string | undefined,
  vocalRange: VocalRange,
  candidates: CandidateSongContext[]
): Promise<GeneratedSetlistResponse> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }

  const candidateListText = candidates
    .map(
      (c, i) =>
        `${i + 1}. [ID: ${c.id}] "${c.title}" (${c.artist}) - Thể loại: ${c.type}\n   Trích dẫn lời: "${c.matched_lyrics_snippet.replace(/\n/g, ' ')}"`
    )
    .join('\n\n');

  const userPrompt = `CHỦ ĐỀ BÀI GIẢNG: "${theme}"
${scripture ? `PHÂN ĐOẠN KINH THÁNH: "${scripture}"\n` : ''}TONE GIỌNG LEADER: ${vocalRange} (${vocalRange === 'male' ? 'Nam' : vocalRange === 'female' ? 'Nữ' : 'Linh hoạt'})

DANH SÁCH ỨNG VIÊN BÀI HÁT TỪ DATABASE THỰC TẾ:
${candidateListText}

Hãy chọn đúng 3 bài hát từ danh sách trên để tạo thành setlist 3 bài (Opener -> Worship -> Closing) và trả về JSON theo schema:
{
  "theme": "${theme}",
  "scripture_reference": "${scripture || ''}",
  "leader_vocal_range": "${vocalRange}",
  "overview": "Mô tả ngắn gọn về hành trình thờ phượng được thiết kế cho chủ đề này",
  "songs": [
    {
      "song_id": "UUID chính xác của bài 1 từ danh sách",
      "song_title": "Tên chính xác của bài 1",
      "artist": "Nghệ sĩ bài 1",
      "position": "opener",
      "position_label": "Bài mở đầu ngợi khen",
      "recommended_key": "G",
      "tempo_feel": "upbeat",
      "liturgical_reasoning": "Lý do mục vụ chọn bài này ở vị trí mở đầu"
    },
    {
      "song_id": "UUID chính xác của bài 2 từ danh sách",
      "song_title": "Tên chính xác của bài 2",
      "artist": "Nghệ sĩ bài 2",
      "position": "worship",
      "position_label": "Thờ phượng sâu lắng",
      "recommended_key": "D",
      "tempo_feel": "reflective",
      "liturgical_reasoning": "Lý do mục vụ chọn bài này ở vị trí thờ phượng sâu lắng"
    },
    {
      "song_id": "UUID chính xác của bài 3 từ danh sách",
      "song_title": "Tên chính xác của bài 3",
      "artist": "Nghệ sĩ bài 3",
      "position": "closing",
      "position_label": "Bài đáp ứng kết thúc",
      "recommended_key": "C",
      "tempo_feel": "triumphant",
      "liturgical_reasoning": "Lý do mục vụ chọn bài này ở vị trí đáp ứng kết thúc"
    }
  ],
  "transitions": [
    {
      "from_song_title": "Tên bài 1",
      "to_song_title": "Tên bài 2",
      "prayer_script": "Lời cầu nguyện dẫn nhập 2-3 câu từ bài 1 sang bài 2",
      "musical_tip": "Gợi ý chuyển tone/nhịp cho ban nhạc"
    },
    {
      "from_song_title": "Tên bài 2",
      "to_song_title": "Tên bài 3",
      "prayer_script": "Lời cầu nguyện dẫn nhập 2-3 câu từ bài 2 sang bài 3",
      "musical_tip": "Gợi ý chuyển tone/nhịp cho ban nhạc"
    }
  ],
  "closing_prayer": "Lời cầu nguyện chúc phước / đúc kết kết thúc buổi thờ phượng"
}`;

  const models = [
    'gemini-3.5-flash',
    'gemini-flash-latest',
  ];
  let lastError: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(6000), // Fast 6s timeout per model attempt
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2, // Low temperature for high adherence to constraints
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[GeminiSetlist] Model ${model} returned ${res.status}: ${errText.slice(0, 100)}`);
        continue;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Gemini response parts were empty');
      }

      const parsed = JSON.parse(rawText);
      const validated = GeneratedSetlistResponseSchema.parse(parsed);

      // Verify that all song_ids exist in candidates, auto-correct if needed
      const candidateMap = new Map(candidates.map((c) => [c.id, c]));
      const titleMap = new Map(candidates.map((c) => [c.title.toLowerCase().trim(), c]));

      validated.songs = validated.songs.map((song) => {
        let matchedCandidate = candidateMap.get(song.song_id);
        if (!matchedCandidate) {
          matchedCandidate = titleMap.get(song.song_title.toLowerCase().trim());
        }

        if (matchedCandidate) {
          return {
            ...song,
            song_id: matchedCandidate.id,
            song_title: matchedCandidate.title,
            artist: matchedCandidate.artist,
          };
        }
        return song;
      });

      return validated;
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini models failed to generate setlist');
}

// ============================================================================
// 4. INTELLIGENT DETERMINISTIC FALLBACK (Offline / Zero-API Mode)
// ============================================================================

function generateOfflineFallbackSetlist(
  theme: string,
  scripture: string | undefined,
  vocalRange: VocalRange,
  candidates: CandidateSongContext[]
): GeneratedSetlistResponse {
  const praises = candidates.filter((c) => c.type === 'praise');
  const worships = candidates.filter((c) => c.type === 'worship');

  const opener = praises[0] || candidates[0];
  const worship = worships.find((c) => c.id !== opener.id) || candidates[1] || candidates[0];
  const closing =
    candidates.find((c) => c.id !== opener.id && c.id !== worship.id) ||
    candidates[2] ||
    candidates[0];

  const defaultKeyOpener = vocalRange === 'female' ? 'D' : 'G';
  const defaultKeyWorship = vocalRange === 'female' ? 'C' : 'D';
  const defaultKeyClosing = vocalRange === 'female' ? 'G' : 'C';

  return {
    theme,
    scripture_reference: scripture,
    leader_vocal_range: vocalRange,
    overview: `Kịch bản thờ phượng 3 bài được điều phối theo luồng phụng vụ chuẩn Cơ Đốc cho chủ đề "${theme}". Từ sự ngợi khen tươi mới bước vào nơi hiện diện sâu nhiệm và đáp ứng cam kết đức tin.`,
    songs: [
      {
        song_id: opener.id,
        song_title: opener.title,
        artist: opener.artist,
        position: 'opener',
        position_label: 'Bài mở đầu ngợi khen',
        recommended_key: defaultKeyOpener,
        tempo_feel: 'upbeat',
        liturgical_reasoning: `Lời ca ngợi khen sống động mở rộng tấm lòng hội chúng, tập chú vào quyền năng của Chúa trước khi bước vào trọng tâm bài giảng.`,
      },
      {
        song_id: worship.id,
        song_title: worship.title,
        artist: worship.artist,
        position: 'worship',
        position_label: 'Thờ phượng sâu lắng',
        recommended_key: defaultKeyWorship,
        tempo_feel: 'reflective',
        liturgical_reasoning: `Bài hát đưa cả hội chúng vào chiều sâu của sự chiêm ngưỡng ân điển và lẽ thật liên quan đến "${theme}".`,
      },
      {
        song_id: closing.id,
        song_title: closing.title,
        artist: closing.artist,
        position: 'closing',
        position_label: 'Bài đáp ứng kết thúc',
        recommended_key: defaultKeyClosing,
        tempo_feel: 'triumphant',
        liturgical_reasoning: `Tuyên xưng đức tin và dâng trọn đời sống để thực hành sứ điệp bài giảng trong đời sống thường nhật.`,
      },
    ],
    transitions: [
      {
        from_song_title: opener.title,
        to_song_title: worship.title,
        prayer_script: `Lạy Chúa, cảm tạ Ngài vì niềm vui được ngợi khen Danh Thánh Chúa. Xin Thần Linh Ngài dẫn dắt chúng con vào sâu hơn trong nơi hiện diện của Cha, chiêm ngưỡng tình yêu lớn lao mà Ngài dành cho chúng con.`,
        musical_tip: `Giữ hợp âm cuối của bài 1 vang nhẹ, piano đánh intro chậm rãi đưa nhịp về bài 2.`,
      },
      {
        from_song_title: worship.title,
        to_song_title: closing.title,
        prayer_script: `Chúa ơi, khi chúng con đã được nghe tiếng Chúa và chạm vào lòng thương xót Ngài, xin ban cho chúng con lòng can đảm để đáp ứng, bước đi và sống bày tỏ vinh quang Ngài giữa trần gian.`,
        musical_tip: `Tăng dần dynamic, trống đánh build-up nhẹ nhàng chuyển sang bài kết thúc trang nghiêm.`,
      },
    ],
    closing_prayer: `Nguyện xin tình yêu của Đức Chúa Cha, ân điển của Đức Chúa Con Giê-xu, và sự thông công của Đức Thánh Linh ở cùng và dẫn dắt mỗi chúng con khi chúng con sống vâng phục lời Ngài. A-men.`,
  };
}

// ============================================================================
// 5. PUBLIC EXPORTED CONTROLLER
// ============================================================================

export async function generateWorshipSetlist(
  params: GenerateSetlistParams
): Promise<GeneratedSetlistResponse> {
  const theme = params.theme.trim();
  if (!theme) {
    throw new Error('Theme is required to generate a worship setlist.');
  }

  const vocalRange = params.leaderVocalRange || 'male';

  // 1. Retrieve Candidate Songs using Hybrid RRF
  const candidates = await retrieveCandidateSongs(theme);
  if (candidates.length === 0) {
    throw new Error(`No relevant songs found in database for theme: "${theme}".`);
  }

  // 2. Call Gemini LLM with Structured Output Constraint
  try {
    return await callGeminiWithCandidates(theme, params.scriptureReference, vocalRange, candidates);
  } catch (err: any) {
    console.warn(
      `[SetlistGenerator] Gemini API call failed (${err.message}). Falling back to intelligent deterministic setlist builder.`
    );
    // Graceful offline fallback guaranteeing 100% uptime
    return generateOfflineFallbackSetlist(theme, params.scriptureReference, vocalRange, candidates);
  }
}
