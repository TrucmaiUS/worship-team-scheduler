import { normalizeForComparison } from './normalization';

// Conservative patterns only. A negative result does not certify that an
// intent is safe; human review remains required for borderline semantic cases.
const EXPLICIT_INTENTS = [
  /holy spirit.{0,45}(bear witness|testif(y|ies)).{0,45}christ/u,
  /(thánh linh|đức thánh linh).{0,45}(làm chứng|chứng đạo).{0,45}(christ|giê|chúa)/u,
  /holy spirit.{0,45}(guide|lead).{0,35}(all truth|mọi lẽ thật)/u,
  /(thánh linh|đức thánh linh).{0,45}(dẫn|hướng dẫn).{0,35}(mọi lẽ thật|chân lý)/u,
  /(cost of discipleship|command of discipleship|commission of discipleship|call of discipleship)/u,
  /(great commission|make disciples of all nations|đại mạng lệnh|môn đồ hóa muôn dân)/u,
];

export function inspectHeldOutIntent(text: string): { explicit: boolean; requiresHumanReview: boolean } {
  const normalized = normalizeForComparison(text);
  const explicit = EXPLICIT_INTENTS.some(pattern => pattern.test(normalized));
  const requiresHumanReview = !explicit && /(discipleship|môn đồ|thánh linh|holy spirit)/u.test(normalized);
  return { explicit, requiresHumanReview };
}
