import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'beatlift.db';
const DATABASE_VERSION = 2;

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
  completed: number;
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
          completed   INTEGER NOT NULL DEFAULT 0,
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
    // v0 の CREATE TABLE は既に最新スキーマ(completed を含む)なので、以降の ALTER は飛ばす
    currentVersion = DATABASE_VERSION;
  }

  if (currentVersion === 1) {
    // 既存 v1 DB へ完了フラグ列を追加(v0 から作った場合は上で最新版に到達済みのため通らない)
    await db.execAsync('ALTER TABLE set_logs ADD COLUMN completed INTEGER NOT NULL DEFAULT 0');
    currentVersion = 2;
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
  patch: { exerciseId?: number | null; weight?: number; reps?: number; completed?: number }
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
  if (patch.completed !== undefined) {
    sets.push('completed = ?');
    values.push(patch.completed);
  }
  if (sets.length === 0) return;
  const db = await getDb();
  await db.runAsync(`UPDATE set_logs SET ${sets.join(', ')} WHERE id = ?`, ...values, id);
}

export async function deleteSetLog(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM set_logs WHERE id = ?', id);
}

/** セッション内の特定種目のセットを一括削除。null は exercise_id IS NULL を対象にする */
export async function deleteSetLogsByExercise(
  sessionId: number,
  exerciseId: number | null
): Promise<void> {
  const db = await getDb();
  if (exerciseId === null) {
    await db.runAsync(
      'DELETE FROM set_logs WHERE session_id = ? AND exercise_id IS NULL',
      sessionId
    );
  } else {
    await db.runAsync(
      'DELETE FROM set_logs WHERE session_id = ? AND exercise_id = ?',
      sessionId,
      exerciseId
    );
  }
}

/** セッション内の特定種目のセットを別種目に付け替える。from が null は IS NULL を対象にする */
export async function changeSetLogsExercise(
  sessionId: number,
  from: number | null,
  to: number
): Promise<void> {
  const db = await getDb();
  if (from === null) {
    await db.runAsync(
      'UPDATE set_logs SET exercise_id = ? WHERE session_id = ? AND exercise_id IS NULL',
      to,
      sessionId
    );
  } else {
    await db.runAsync(
      'UPDATE set_logs SET exercise_id = ? WHERE session_id = ? AND exercise_id = ?',
      to,
      sessionId,
      from
    );
  }
}

/** セッションのメモを取得。未設定(null)は空文字を返す */
export async function getSessionNote(sessionId: number): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ note: string | null }>(
    'SELECT note FROM workout_sessions WHERE id = ?',
    sessionId
  );
  return row?.note ?? '';
}

export async function updateSessionNote(sessionId: number, note: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE workout_sessions SET note = ? WHERE id = ?', note, sessionId);
}

/** カスタム種目を追加。is_default=0、sort_order は既存の最大値+1 */
export async function insertExercise(name: string, bodyPart: string | null): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ maxOrder: number | null }>(
    'SELECT MAX(sort_order) AS maxOrder FROM exercises'
  );
  const sortOrder = (row?.maxOrder ?? -1) + 1;
  const result = await db.runAsync(
    'INSERT INTO exercises (name, body_part, is_default, sort_order) VALUES (?, ?, 0, ?)',
    name,
    bodyPart,
    sortOrder
  );
  return result.lastInsertRowId;
}

/**
 * beforeDate より前の、その種目を実施した直近日の全セットを返す。
 * weight>0 または reps>0 のセットがある日を「実施日」とみなす。
 */
export async function getLastPerformance(
  exerciseId: number,
  beforeDate: string
): Promise<{ date: string; sets: { weight: number; reps: number }[] } | null> {
  const db = await getDb();
  const dateRow = await db.getFirstAsync<{ date: string }>(
    `SELECT s.date AS date
       FROM set_logs l
       JOIN workout_sessions s ON s.id = l.session_id
      WHERE l.exercise_id = ? AND s.date < ? AND (l.weight > 0 OR l.reps > 0)
      ORDER BY s.date DESC
      LIMIT 1`,
    exerciseId,
    beforeDate
  );
  if (!dateRow) return null;
  const sets = await db.getAllAsync<{ weight: number; reps: number }>(
    `SELECT l.weight AS weight, l.reps AS reps
       FROM set_logs l
       JOIN workout_sessions s ON s.id = l.session_id
      WHERE l.exercise_id = ? AND s.date = ? AND (l.weight > 0 OR l.reps > 0)
      ORDER BY l.set_order, l.id`,
    exerciseId,
    dateRow.date
  );
  return { date: dateRow.date, sets };
}

/** beforeDate より前の全セットから Epley 式の推定1RM 最大値を返す。なければ 0 */
export async function getBestE1RM(exerciseId: number, beforeDate: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ best: number | null }>(
    `SELECT MAX(
              CASE
                WHEN l.reps = 1 THEN l.weight
                WHEN l.reps > 0 AND l.weight > 0 THEN l.weight * (1.0 + l.reps / 30.0)
                ELSE 0
              END
            ) AS best
       FROM set_logs l
       JOIN workout_sessions s ON s.id = l.session_id
      WHERE l.exercise_id = ? AND s.date < ?`,
    exerciseId,
    beforeDate
  );
  return Math.round(row?.best ?? 0);
}

/** beforeDate より前で、セットを1件以上持つ直近セッションの総ボリューム */
export async function getPreviousSessionVolume(
  beforeDate: string
): Promise<{ date: string; volume: number } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ date: string; volume: number }>(
    `SELECT s.date AS date, SUM(l.weight * l.reps) AS volume
       FROM workout_sessions s
       JOIN set_logs l ON l.session_id = s.id
      WHERE s.date < ?
      GROUP BY s.id
      ORDER BY s.date DESC
      LIMIT 1`,
    beforeDate
  );
  if (!row) return null;
  return { date: row.date, volume: row.volume ?? 0 };
}

/** セッションの全セットを種目名付きで返す(詳細シート用) */
export async function getSessionSets(
  sessionId: number
): Promise<{ exerciseName: string | null; weight: number; reps: number; setOrder: number }[]> {
  const db = await getDb();
  return db.getAllAsync<{
    exerciseName: string | null;
    weight: number;
    reps: number;
    setOrder: number;
  }>(
    `SELECT e.name AS exerciseName, l.weight, l.reps, l.set_order AS setOrder
       FROM set_logs l
       LEFT JOIN exercises e ON e.id = l.exercise_id
      WHERE l.session_id = ?
      ORDER BY l.set_order, l.id`,
    sessionId
  );
}

/** セットを1件以上持つセッションを date 降順で返す(履歴一覧用) */
export async function listRecentSessions(
  limit: number
): Promise<
  {
    id: number;
    date: string;
    note: string | null;
    volume: number;
    setCount: number;
    exerciseNames: string | null;
  }[]
> {
  const db = await getDb();
  return db.getAllAsync<{
    id: number;
    date: string;
    note: string | null;
    volume: number;
    setCount: number;
    exerciseNames: string | null;
  }>(
    `SELECT s.id AS id,
            s.date AS date,
            s.note AS note,
            SUM(l.weight * l.reps) AS volume,
            COUNT(l.id) AS setCount,
            GROUP_CONCAT(DISTINCT e.name) AS exerciseNames
       FROM workout_sessions s
       JOIN set_logs l ON l.session_id = s.id
       LEFT JOIN exercises e ON e.id = l.exercise_id
      GROUP BY s.id
      ORDER BY s.date DESC
      LIMIT ?`,
    limit
  );
}

/** 全期間の月ごとの総ボリューム */
export async function getMonthlyVolumes(): Promise<{ month: string; volume: number }[]> {
  const db = await getDb();
  return db.getAllAsync<{ month: string; volume: number }>(
    `SELECT substr(s.date, 1, 7) AS month, SUM(l.weight * l.reps) AS volume
       FROM workout_sessions s
       JOIN set_logs l ON l.session_id = s.id
      GROUP BY month
      ORDER BY month ASC`
  );
}

/** 種目ごとの推定1RM推移(Epley式) */
export async function get1RMHistory(
  exerciseId: number
): Promise<{ date: string; rm: number }[]> {
  const db = await getDb();
  return db.getAllAsync<{ date: string; rm: number }>(
    `SELECT s.date, MAX(l.weight * (1.0 + l.reps / 30.0)) AS rm
       FROM set_logs l
       JOIN workout_sessions s ON s.id = l.session_id
      WHERE l.exercise_id = ?
        AND l.reps > 0
      GROUP BY s.date
      ORDER BY s.date ASC`,
    exerciseId
  );
}

/** セット記録がある種目の一覧 */
export async function getExercisesWithHistory(): Promise<{ id: number; name: string }[]> {
  const db = await getDb();
  return db.getAllAsync<{ id: number; name: string }>(
    `SELECT DISTINCT e.id, e.name
       FROM exercises e
       JOIN set_logs l ON l.exercise_id = e.id
      ORDER BY e.sort_order, e.name`
  );
}

/** 指定月(monthPrefix 例: '2026-06')の、セットを持つセッション数と総ボリューム */
export async function getMonthlyStats(
  monthPrefix: string
): Promise<{ sessions: number; volume: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ sessions: number; volume: number | null }>(
    `SELECT COUNT(DISTINCT s.id) AS sessions, SUM(l.weight * l.reps) AS volume
       FROM workout_sessions s
       JOIN set_logs l ON l.session_id = s.id
      WHERE s.date LIKE ? || '%'`,
    monthPrefix
  );
  return { sessions: row?.sessions ?? 0, volume: row?.volume ?? 0 };
}
