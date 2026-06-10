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
};

type WorkoutStore = {
  selectedDate: string; // 'YYYY-MM-DD'
  sessionId: number | null;
  exercises: Exercise[];
  setLogs: SetLog[];
  loading: boolean;

  init: () => Promise<void>;
  loadExercises: () => Promise<void>;
  loadSession: (date: string) => Promise<void>;
  addSetLog: () => Promise<void>;
  duplicateSetLog: (id: number) => Promise<void>;
  updateSetLog: (id: number, patch: Partial<Omit<SetLog, 'id'>>) => Promise<void>;
  removeSetLog: (id: number) => Promise<void>;
};

export const useWorkoutStore = create<WorkoutStore>()((set, get) => ({
  selectedDate: todayKey(),
  sessionId: null,
  exercises: [],
  setLogs: [],
  loading: true,

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
    // 連打で日付を切り替えた場合、最後に選んだ日以外の結果は捨てる
    if (get().selectedDate !== date) return;
    set({
      sessionId,
      loading: false,
      setLogs: rows.map((r) => ({
        id: r.id,
        exerciseId: r.exercise_id,
        weight: r.weight,
        reps: r.reps,
      })),
    });
  },

  addSetLog: async () => {
    const { sessionId, setLogs } = get();
    if (sessionId == null) return;
    // 直前の行の種目を引き継ぐ(同一種目で複数セット組むのが普通のため)
    const last = setLogs[setLogs.length - 1];
    const exerciseId = last?.exerciseId ?? null;
    const id = await repo.insertSetLog(sessionId, {
      exerciseId,
      weight: 0,
      reps: 0,
      setOrder: setLogs.length,
    });
    set({ setLogs: [...get().setLogs, { id, exerciseId, weight: 0, reps: 0 }] });
  },

  duplicateSetLog: async (id) => {
    const { sessionId, setLogs } = get();
    if (sessionId == null) return;
    const source = setLogs.find((l) => l.id === id);
    if (!source) return;
    const newId = await repo.insertSetLog(sessionId, {
      exerciseId: source.exerciseId,
      weight: source.weight,
      reps: source.reps,
      setOrder: setLogs.length,
    });
    set({
      setLogs: [
        ...get().setLogs,
        { id: newId, exerciseId: source.exerciseId, weight: source.weight, reps: source.reps },
      ],
    });
  },

  updateSetLog: async (id, patch) => {
    // 入力のたびに呼ばれるので、まず state を更新して総重量を即時反映する
    set({
      setLogs: get().setLogs.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
    await repo.updateSetLogRow(id, patch);
  },

  removeSetLog: async (id) => {
    set({ setLogs: get().setLogs.filter((l) => l.id !== id) });
    await repo.deleteSetLog(id);
  },
}));

// derived: 総重量 = Σ(重量 × レップ数)
export const selectTotalVolume = (s: Pick<WorkoutStore, 'setLogs'>): number =>
  s.setLogs.reduce((sum, l) => sum + l.weight * l.reps, 0);

export const selectTotalSets = (s: Pick<WorkoutStore, 'setLogs'>): number => s.setLogs.length;
