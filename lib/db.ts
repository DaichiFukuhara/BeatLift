import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'beatlift.db';
const DATABASE_VERSION = 1;

export type ExerciseRow = {
  id: number;
  name: string;
  body_part: string | null;
  is_default: number;
  sort_order: number;
};

export type SetLogRow = {
  id: number;
  session_id: number;
  exercise_id: number | null;
  weight: number;
  reps: number;
  set_order: number;
  created_at: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrateDbIfNeeded(db);
      return db;
    })();
  }
  return dbPromise;
}

// 部位ごとのデフォルト種目シード
const DEFAULT_EXERCISES: [name: string, bodyPart: string][] = [
  ['ベンチプレス', '胸'],
  ['インクラインベンチプレス', '胸'],
  ['ダンベルプレス', '胸'],
  ['ダンベルフライ', '胸'],
  ['チェストプレス', '胸'],
  ['デッドリフト', '背中'],
  ['ベントオーバーロー', '背中'],
  ['ラットプルダウン', '背中'],
  ['懸垂', '背中'],
  ['シーテッドロー', '背中'],
  ['スクワット', '脚'],
  ['レッグプレス', '脚'],
  ['レッグエクステンション', '脚'],
  ['レッグカール', '脚'],
  ['カーフレイズ', '脚'],
  ['ショルダープレス', '肩'],
  ['サイドレイズ', '肩'],
  ['リアレイズ', '肩'],
  ['バーベルカール', '腕'],
  ['ダンベルカール', '腕'],
  ['トライセプスプレスダウン', '腕'],
  ['クランチ', '腹'],
  ['アブローラー', '腹'],
];

async function migrateDbIfNeeded(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) return;

  if (currentVersion === 0) {
    await db.withTransactionAsync(async () => {
      // exercise_id は「種目未選択の下書き行」を許すため NULL 可にしている
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS exercises (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT NOT NULL,
          body_part   TEXT,
          is_default  INTEGER DEFAULT 0,
          sort_order  INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS workout_sessions (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          date        TEXT NOT NULL,
          started_at  TEXT,
          ended_at    TEXT,
          note        TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_date ON workout_sessions(date);

        CREATE TABLE IF NOT EXISTS set_logs (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id  INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
          exercise_id INTEGER REFERENCES exercises(id),
          weight      REAL NOT NULL DEFAULT 0,
          reps        INTEGER NOT NULL DEFAULT 0,
          set_order   INTEGER DEFAULT 0,
          created_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_setlogs_session ON set_logs(session_id);
      `);

      const statement = await db.prepareAsync(
        'INSERT INTO exercises (name, body_part, is_default, sort_order) VALUES ($name, $bodyPart, 1, $sortOrder)'
      );
      try {
        for (let i = 0; i < DEFAULT_EXERCISES.length; i++) {
          const [name, bodyPart] = DEFAULT_EXERCISES[i];
          await statement.executeAsync({ $name: name, $bodyPart: bodyPart, $sortOrder: i });
        }
      } finally {
        await statement.finalizeAsync();
      }
    });
    currentVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

// ---- リポジトリ関数 ----

export async function listExercises(): Promise<ExerciseRow[]> {
  const db = await getDb();
  return db.getAllAsync<ExerciseRow>(
    'SELECT * FROM exercises ORDER BY sort_order, id'
  );
}

/** 指定日のセッションを取得。なければ作成して返す */
export async function getOrCreateSession(date: string): Promise<number> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM workout_sessions WHERE date = ?',
    date
  );
  if (existing) return existing.id;
  const result = await db.runAsync('INSERT INTO workout_sessions (date) VALUES (?)', date);
  return result.lastInsertRowId;
}

export async function listSetLogs(sessionId: number): Promise<SetLogRow[]> {
  const db = await getDb();
  return db.getAllAsync<SetLogRow>(
    'SELECT * FROM set_logs WHERE session_id = ? ORDER BY set_order, id',
    sessionId
  );
}

export async function insertSetLog(
  sessionId: number,
  log: { exerciseId: number | null; weight: number; reps: number; setOrder: number }
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO set_logs (session_id, exercise_id, weight, reps, set_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    sessionId,
    log.exerciseId,
    log.weight,
    log.reps,
    log.setOrder,
    new Date().toISOString()
  );
  return result.lastInsertRowId;
}

export async function updateSetLogRow(
  id: number,
  patch: { exerciseId?: number | null; weight?: number; reps?: number }
): Promise<void> {
  const sets: string[] = [];
  const values: SQLite.SQLiteBindValue[] = [];
  if (patch.exerciseId !== undefined) {
    sets.push('exercise_id = ?');
    values.push(patch.exerciseId);
  }
  if (patch.weight !== undefined) {
    sets.push('weight = ?');
    values.push(patch.weight);
  }
  if (patch.reps !== undefined) {
    sets.push('reps = ?');
    values.push(patch.reps);
  }
  if (sets.length === 0) return;
  const db = await getDb();
  await db.runAsync(`UPDATE set_logs SET ${sets.join(', ')} WHERE id = ?`, ...values, id);
}

export async function deleteSetLog(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM set_logs WHERE id = ?', id);
}
