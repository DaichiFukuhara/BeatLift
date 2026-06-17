import { create } from 'zustand';

import * as repo from '@/lib/db';
import { todayKey } from '@/lib/date';

export type Exercise = {
  id: number;
  name: string;
  bodyPart: string | null;
};

export type SetLog = {
  id: number;
  exerciseId: number | null;
  weight: number;
  reps: number;
  completed: boolean;
};

export type ExerciseHistory = {
  last: { date: string; sets: { weight: number; reps: number }[] } | null;
  bestE1RM: number;
};

export type ExerciseGroup = {
  key: string;
  exerciseId: number | null;
  sets: SetLog[];
};

export const REST_TIMER_DEFAULT_SEC = 90;

type WorkoutStore = {
  selectedDate: string; // 'YYYY-MM-DD'
  sessionId: number | null;
  exercises: Exercise[];
  setLogs: SetLog[];
  loading: boolean;
  note: string; // 表示中セッションのメモ
  prevSession: { date: string; volume: number } | null; // selectedDate より前の直近セッション
  historyByExercise: Record<number, ExerciseHistory>; // loadSession で {} にクリア
  restTimer: { endsAt: number; totalSec: number } | null; // endsAt は epoch ms

  init: () => Promise<void>;
  loadExercises: () => Promise<void>;
  loadSession: (date: string) => Promise<void>;
  addSetForExercise: (exerciseId: number) => Promise<void>;
  updateSetLog: (id: number, patch: Partial<Omit<SetLog, 'id'>>) => Promise<void>;
  removeSetLog: (id: number) => Promise<void>;
  removeExerciseGroup: (exerciseId: number | null) => Promise<void>;
  changeGroupExercise: (from: number | null, to: number) => Promise<void>;
  toggleSetCompleted: (id: number) => Promise<void>;
  saveNote: (note: string) => Promise<void>;
  ensureExerciseHistory: (exerciseId: number) => Promise<void>;
  addCustomExercise: (name: string, bodyPart: string | null) => Promise<number>;
  startRestTimer: (seconds?: number) => void;
  adjustRestTimer: (deltaSec: number) => void;
  stopRestTimer: () => void;
};

export const useWorkoutStore = create<WorkoutStore>()((set, get) => ({
  selectedDate: todayKey(),
  sessionId: null,
  exercises: [],
  setLogs: [],
  loading: true,
  note: '',
  prevSession: null,
  historyByExercise: {},
  restTimer: null,

  init: async () => {
    await get().loadExercises();
    await get().loadSession(get().selectedDate);
  },

  loadExercises: async () => {
    const rows = await repo.listExercises();
    set({
      exercises: rows.map((r) => ({ id: r.id, name: r.name, bodyPart: r.body_part })),
    });
  },

  loadSession: async (date) => {
    set({ selectedDate: date, loading: true });
    const sessionId = await repo.getOrCreateSession(date);
    const rows = await repo.listSetLogs(sessionId);
    const note = await repo.getSessionNote(sessionId);
    const prevSession = await repo.getPreviousSessionVolume(date);
    // 連打で日付を切り替えた場合、最後に選んだ日以外の結果は捨てる
    if (get().selectedDate !== date) return;
    set({
      sessionId,
      loading: false,
      note,
      prevSession,
      historyByExercise: {},
      setLogs: rows.map((r) => ({
        id: r.id,
        exerciseId: r.exercise_id,
        weight: r.weight,
        reps: r.reps,
        completed: r.completed !== 0,
      })),
    });
  },

  addSetForExercise: async (exerciseId) => {
    const { sessionId, setLogs } = get();
    if (sessionId == null) return;
    // 同一種目の最後のセットがあれば重量/レップを引き継ぐ(同じ種目で複数セット組むのが普通のため)
    const sameExercise = setLogs.filter((l) => l.exerciseId === exerciseId);
    const last = sameExercise[sameExercise.length - 1];
    const weight = last?.weight ?? 0;
    const reps = last?.reps ?? 0;
    const id = await repo.insertSetLog(sessionId, {
      exerciseId,
      weight,
      reps,
      setOrder: setLogs.length,
    });
    set({
      setLogs: [...get().setLogs, { id, exerciseId, weight, reps, completed: false }],
    });
    await get().ensureExerciseHistory(exerciseId);
  },

  updateSetLog: async (id, patch) => {
    // 入力のたびに呼ばれるので、まず state を更新して総重量を即時反映する
    set({
      setLogs: get().setLogs.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
    // completed は boolean で受けて DB には 0/1 で書く
    const { completed, ...rest } = patch;
    await repo.updateSetLogRow(id, {
      ...rest,
      ...(completed !== undefined ? { completed: completed ? 1 : 0 } : {}),
    });
  },

  removeSetLog: async (id) => {
    set({ setLogs: get().setLogs.filter((l) => l.id !== id) });
    await repo.deleteSetLog(id);
  },

  removeExerciseGroup: async (exerciseId) => {
    const { sessionId } = get();
    set({ setLogs: get().setLogs.filter((l) => l.exerciseId !== exerciseId) });
    if (sessionId == null) return;
    await repo.deleteSetLogsByExercise(sessionId, exerciseId);
  },

  changeGroupExercise: async (from, to) => {
    const { sessionId } = get();
    set({
      setLogs: get().setLogs.map((l) => (l.exerciseId === from ? { ...l, exerciseId: to } : l)),
    });
    if (sessionId != null) {
      await repo.changeSetLogsExercise(sessionId, from, to);
    }
    await get().ensureExerciseHistory(to);
  },

  toggleSetCompleted: async (id) => {
    const target = get().setLogs.find((l) => l.id === id);
    if (!target) return;
    const next = !target.completed;
    await get().updateSetLog(id, { completed: next });
    // 未完了→完了にした時だけ、内容のあるセットならインターバルを開始する
    if (next && (target.weight > 0 || target.reps > 0)) {
      get().startRestTimer();
    }
  },

  saveNote: async (note) => {
    const { sessionId } = get();
    set({ note });
    if (sessionId == null) return;
    await repo.updateSessionNote(sessionId, note);
  },

  ensureExerciseHistory: async (exerciseId) => {
    if (get().historyByExercise[exerciseId]) return;
    const date = get().selectedDate;
    const last = await repo.getLastPerformance(exerciseId, date);
    const bestE1RM = await repo.getBestE1RM(exerciseId, date);
    set({
      historyByExercise: {
        ...get().historyByExercise,
        [exerciseId]: { last, bestE1RM },
      },
    });
  },

  addCustomExercise: async (name, bodyPart) => {
    const id = await repo.insertExercise(name, bodyPart);
    await get().loadExercises();
    return id;
  },

  startRestTimer: (seconds = REST_TIMER_DEFAULT_SEC) => {
    set({ restTimer: { endsAt: Date.now() + seconds * 1000, totalSec: seconds } });
  },

  adjustRestTimer: (deltaSec) => {
    const { restTimer } = get();
    if (!restTimer) return;
    const endsAt = restTimer.endsAt + deltaSec * 1000;
    // 調整の結果、残り時間が 0 以下になるなら止める
    if (endsAt - Date.now() <= 0) {
      get().stopRestTimer();
      return;
    }
    set({ restTimer: { endsAt, totalSec: restTimer.totalSec + deltaSec } });
  },

  stopRestTimer: () => {
    set({ restTimer: null });
  },
}));

// derived: 総重量 = Σ(重量 × レップ数)
export const selectTotalVolume = (s: Pick<WorkoutStore, 'setLogs'>): number =>
  s.setLogs.reduce((sum, l) => sum + l.weight * l.reps, 0);

export const selectTotalSets = (s: Pick<WorkoutStore, 'setLogs'>): number => s.setLogs.length;

export const selectCompletedSets = (s: Pick<WorkoutStore, 'setLogs'>): number =>
  s.setLogs.filter((l) => l.completed).length;

/** setLogs を exerciseId ごとに出現順でグループ化する純関数 */
export function groupSetLogs(setLogs: SetLog[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  const byKey = new Map<string, ExerciseGroup>();
  for (const log of setLogs) {
    const key = log.exerciseId == null ? 'none' : String(log.exerciseId);
    let group = byKey.get(key);
    if (!group) {
      group = { key, exerciseId: log.exerciseId, sets: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.sets.push(log);
  }
  return groups;
}
