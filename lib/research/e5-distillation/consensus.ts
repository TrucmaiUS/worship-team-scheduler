import {
  ConsensusRecord,
  RelevanceJudgment,
  RelevanceJudgmentSchema,
  RelevanceScore,
} from './types';

function assertSameCandidate(
  teacher: RelevanceJudgment,
  judge: RelevanceJudgment
): void {
  const fields: Array<keyof RelevanceJudgment> = [
    'queryId',
    'candidateSongId',
    'candidateSectionId',
  ];

  for (const field of fields) {
    if (teacher[field] !== judge[field]) {
      throw new Error(`Judgments do not refer to the same ${field}.`);
    }
  }
  if (teacher.role !== 'gemini_teacher') {
    throw new Error('Teacher judgment must use role gemini_teacher.');
  }
  if (judge.role !== 'gpt_independent_judge') {
    throw new Error('Judge judgment must use role gpt_independent_judge.');
  }
}

function highConfidenceUse(score: RelevanceScore): Pick<
  ConsensusRecord,
  'automaticTrainingEligible' | 'trainingUse' | 'exclusionReasons'
> {
  if (score >= 2) {
    return {
      automaticTrainingEligible: true,
      trainingUse: 'positive',
      exclusionReasons: [],
    };
  }
  if (score === 0) {
    return {
      automaticTrainingEligible: true,
      trainingUse: 'explicit_negative',
      exclusionReasons: [],
    };
  }
  return {
    automaticTrainingEligible: false,
    trainingUse: 'partial_relevance_excluded',
    exclusionReasons: ['grade_one_is_not_a_strong_negative'],
  };
}

export function buildConsensusRecord(
  rawTeacher: RelevanceJudgment,
  rawJudge: RelevanceJudgment
): ConsensusRecord {
  const teacher = RelevanceJudgmentSchema.parse(rawTeacher);
  const judge = RelevanceJudgmentSchema.parse(rawJudge);
  assertSameCandidate(teacher, judge);

  const base = {
    queryId: teacher.queryId,
    candidateSongId: teacher.candidateSongId,
    candidateSectionId: teacher.candidateSectionId,
    teacherJudgmentId: teacher.judgmentId,
    judgeJudgmentId: judge.judgmentId,
    teacherScore: teacher.relevanceScore,
    judgeScore: judge.relevanceScore,
    absoluteDelta: Math.abs(teacher.relevanceScore - judge.relevanceScore),
  };

  if (!teacher.schemaValid || !judge.schemaValid) {
    return {
      ...base,
      confidenceTier: 'invalid_run_record',
      consensusGrade: null,
      automaticTrainingEligible: false,
      trainingUse: 'excluded',
      exclusionReasons: ['schema_invalid'],
    };
  }

  const requiredEvidenceInvalid = [teacher, judge].some(
    (judgment) => judgment.relevanceScore >= 2 && judgment.evidenceStatus !== 'valid'
  );
  if (requiredEvidenceInvalid) {
    return {
      ...base,
      confidenceTier: 'invalid_evidence',
      consensusGrade: null,
      automaticTrainingEligible: false,
      trainingUse: 'excluded',
      exclusionReasons: ['required_evidence_invalid'],
    };
  }

  if (base.absoluteDelta === 0) {
    const use = highConfidenceUse(teacher.relevanceScore);
    return {
      ...base,
      confidenceTier: 'high_confidence',
      consensusGrade: teacher.relevanceScore,
      ...use,
    };
  }

  if (base.absoluteDelta === 1) {
    return {
      ...base,
      confidenceTier: 'medium_confidence',
      consensusGrade: null,
      automaticTrainingEligible: false,
      trainingUse: 'separate_medium_confidence',
      exclusionReasons: ['delta_one_requires_separate_review_or_ablation'],
    };
  }

  return {
    ...base,
    confidenceTier: 'major_disagreement',
    consensusGrade: null,
    automaticTrainingEligible: false,
    trainingUse: 'excluded',
    exclusionReasons: ['delta_two_or_more'],
  };
}
