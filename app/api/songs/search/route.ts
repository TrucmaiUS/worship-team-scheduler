import { NextRequest, NextResponse } from 'next/server';
import { searchByKeyword } from '@/lib/search/keyword-search';
import { searchBySemantic } from '@/lib/search/semantic-search';
import { searchHybrid } from '@/lib/search/hybrid-search';
import { SearchOptions } from '@/lib/search/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const method = (searchParams.get('method') || 'hybrid') as 'keyword' | 'semantic' | 'hybrid';
    const status = (searchParams.get('status') || 'all') as 'approved' | 'all';
    const type = (searchParams.get('type') || 'all') as 'all' | 'praise' | 'worship';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!query.trim()) {
      return NextResponse.json({
        success: true,
        query: '',
        method,
        total: 0,
        results: [],
      });
    }

    const options: SearchOptions = {
      limit: Math.min(Math.max(limit, 1), 50),
      eligibilityStatus: status,
      songTypeFilter: type,
    };

    let results = [];

    switch (method) {
      case 'keyword':
        results = await searchByKeyword(query, options);
        break;
      case 'semantic':
        results = await searchBySemantic(query, options);
        break;
      case 'hybrid':
      default:
        results = await searchHybrid(query, options);
        break;
    }

    return NextResponse.json({
      success: true,
      query,
      method,
      total: results.length,
      results,
    });
  } catch (err: any) {
    console.error('Search API Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
