import { db } from '@/lib/db';
import { municipalityQuizResults, municipalityMaster } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import {
  inferSessions,
  computeCellAccuracies,
  computeCellCoverages,
} from './cell-stats';
import { extractFitZone } from './fit-zone';
import type { LearnerState, GameMode, Difficulty } from './types';

type QuizResultRow = typeof municipalityQuizResults.$inferSelect;
type MasterRow = typeof municipalityMaster.$inferSelect;
type CrowdRow = { difficulty: string; correctCount: number; totalCount: number };

function calculateCrowdAccuracy(crowdRows: CrowdRow[]): Record<Difficulty, number> {
  const crowdAccuracy: Record<Difficulty, number> = {
    easy: 0.6,
    medium: 0.55,
    hard: 0.5,
    expert: 0.45,
  };
  for (const row of crowdRows) {
    const total = Number(row.totalCount);
    const correct = Number(row.correctCount);
    if (total > 0 && row.difficulty in crowdAccuracy) {
      crowdAccuracy[row.difficulty as Difficulty] = correct / total;
    }
  }
  return crowdAccuracy;
}

function calculateWeaknessMap(allResults: QuizResultRow[]): Map<string, number> {
  const weaknessByMunicipality = new Map<string, number>();
  const codeStats = new Map<string, { total: number; wrong: number }>();
  for (const r of allResults) {
    const s = codeStats.get(r.municipalityCode) ?? { total: 0, wrong: 0 };
    s.total++;
    if (!r.isCorrect) s.wrong++;
    codeStats.set(r.municipalityCode, s);
  }
  for (const [code, { total, wrong }] of codeStats) {
    if (total > 0) weaknessByMunicipality.set(code, wrong / total);
  }
  return weaknessByMunicipality;
}

function extractRecentlyPlayedCodes(allResults: QuizResultRow[]): Set<string> {
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const recentlyPlayedCodes = new Set<string>();
  for (const r of allResults) {
    if (now - new Date(r.answeredAt).getTime() <= THIRTY_DAYS_MS) {
      recentlyPlayedCodes.add(r.municipalityCode);
    }
  }
  return recentlyPlayedCodes;
}

function extractPlayedModes(allResults: QuizResultRow[]): Set<GameMode> {
  const playedModes = new Set<GameMode>();
  for (const r of allResults) {
    playedModes.add(r.mode as GameMode);
  }
  return playedModes;
}

async function fetchLearnerData(userId: string) {
  return Promise.all([
    db
      .select()
      .from(municipalityQuizResults)
      .where(eq(municipalityQuizResults.userId, userId))
      .orderBy(municipalityQuizResults.answeredAt),
    db.select().from(municipalityMaster),
    db
      .select({
        difficulty: municipalityMaster.difficulty,
        correctCount: sql<number>`CAST(COUNT(*) FILTER (WHERE ${municipalityQuizResults.isCorrect}) AS int)`,
        totalCount: sql<number>`CAST(COUNT(*) AS int)`,
      })
      .from(municipalityQuizResults)
      .innerJoin(
        municipalityMaster,
        eq(municipalityQuizResults.municipalityCode, municipalityMaster.code),
      )
      .groupBy(municipalityMaster.difficulty),
  ]);
}

function convertToSessions(allResults: QuizResultRow[]) {
  return inferSessions(
    allResults.map((r) => ({
      municipalityCode: r.municipalityCode,
      municipalityName: r.municipalityName,
      prefecture: r.prefecture,
      mode: r.mode,
      isCorrect: r.isCorrect,
      answeredAt: r.answeredAt,
    })),
  );
}

export async function buildLearnerState(userId: string): Promise<{
  state: LearnerState;
  allMaster: MasterRow[];
}> {
  const [allResults, allMasterRows, crowdRows] = await fetchLearnerData(userId);
  const masterMap = new Map(allMasterRows.map((m) => [m.code, m]));
  const crowdAccuracyByDifficulty = calculateCrowdAccuracy(crowdRows);

  const sessions = convertToSessions(allResults);
  const cellAccuracies = computeCellAccuracies(sessions, masterMap, crowdAccuracyByDifficulty);
  const fitZone = extractFitZone(cellAccuracies);

  const correctCodes = new Set(allResults.filter((r) => r.isCorrect).map((r) => r.municipalityCode));
  const cellCoverages = computeCellCoverages(allMasterRows, correctCodes);
  const weaknessByMunicipality = calculateWeaknessMap(allResults);

  const lastSession = sessions[sessions.length - 1] ?? null;
  const recentSessions = sessions.slice(-10);

  const state: LearnerState = {
    userId,
    totalSessions: sessions.length,
    totalAnswers: allResults.length,
    cellAccuracies,
    cellCoverages,
    fitZone,
    weaknessByMunicipality,
    lastSessionAccuracy: lastSession?.accuracy ?? null,
    recentQuestionCounts: recentSessions.map((s) => s.count),
    recentlyPlayedCodes: extractRecentlyPlayedCodes(allResults),
    playedModes: extractPlayedModes(allResults),
    crowdAccuracyByDifficulty,
  };

  return { state, allMaster: allMasterRows };
}
