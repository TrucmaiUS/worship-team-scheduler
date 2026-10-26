import { NextRequest, NextResponse } from 'next/server';
import { generateWorshipSetlist } from '@/lib/ai/setlist-generator';
import { z } from 'zod';

const RequestSchema = z.object({
  theme: z.string().min(2, 'Chủ đề bài giảng phải có ít nhất 2 ký tự'),
  scriptureReference: z.string().optional(),
  leaderVocalRange: z.enum(['male', 'female', 'any']).default('male'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
        },
        { status: 400 }
      );
    }

    const { theme, scriptureReference, leaderVocalRange } = parsed.data;

    const setlist = await generateWorshipSetlist({
      theme,
      scriptureReference,
      leaderVocalRange,
    });

    return NextResponse.json({
      success: true,
      data: setlist,
    });
  } catch (err: any) {
    console.error('[API Setlist Generate Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Lỗi khi tạo kịch bản thờ phượng',
      },
      { status: 500 }
    );
  }
}
