// データ層: SQLite への読み書きを一手に引き受けるリポジトリ。
// 画面やストアはこのファイルが公開する関数だけを呼び、生の SQL には触れない。
import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'beatlift.db';
// スキーマの世代番号。スキーマを変えたらこの値を上げ、migrateDbIfNeeded に移行処理を足す
const DATABASE_VERSION = 2;

// DB の行をそのまま写した型。列名は snake_case（DB の都合）で、
// アプリ側の camelCase 型(store の Exercise / SetLog)へはストアで変換する。
export type ExerciseRow = {
  id: number;
  name: string;
  body_part: string | null;
  is_default: number; // 1=プリセット種目, 0=ユーザー追加
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

// 接続は一度だけ開いて使い回す(シングルトン)。Promise を保持するので、
// 初回の準備中に複数箇所から呼ばれても同じ接続を待つだけで済む。
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** DB 接続を取得する。初回呼び出し時だけ接続を開いてマイグレーションを実行する */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      // WAL=書き込み性能向上 / foreign_keys=ON で外部キー(CASCADE削除など)を有効化
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

/**
 * 端末内 DB のスキーマを現行版まで段階的に引き上げる。
 * PRAGMA user_version に「その端末の現在の世代」を記録し、
 * 起動のたびに DATABASE_VERSION と比べて足りない分だけ移行する。
 */
async function migrateDbIfNeeded(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;
  // 既に最新(またはそれ以上)なら何もしない
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

      // デフォルト種目を投入。同じ INSERT を23回繰り返すので、
      // プリペアドステートメント(コンパイル済みSQL)を使い回して高速化する
      const statement = await db.prepareAsync(
        'INSERT INTO exercises (name, body_part, is_default, sort_order) VALUES ($name, $bodyPart, 1, $sortOrder)',
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
// 各関数は getDb() で接続を得てから1つの SQL を実行する薄いラッパー。
// 取得系は getAllAsync(複数行) / getFirstAsync(1行)、更新系は runAsync を使う。

/** 全種目を表示順(sort_order→id)で返す */
export async function listExercises(): Promise<ExerciseRow[]> {
  const db = await getDb();
  return db.getAllAsync<ExerciseRow>('SELECT * FROM exercises ORDER BY sort_order, id');
}

/** 指定日のセッションを取得。なければ作成して返す */
export async function getOrCreateSession(date: string): Promise<number> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM workout_sessions WHERE date = ?',
    date,
  );
  if (existing) return existing.id;
  const result = await db.runAsync('INSERT INTO workout_sessions (date) VALUES (?)', date);
  return result.lastInsertRowId;
}

/** 指定セッションのセットを並び順(set_order→id)で返す */
export async function listSetLogs(sessionId: number): Promise<SetLogRow[]> {
  const db = await getDb();
  return db.getAllAsync<SetLogRow>(
    'SELECT * FROM set_logs WHERE session_id = ? ORDER BY set_order, id',
    sessionId,
  );
}

/** セットを1件追加し、採番された id を返す。created_at は現在時刻を ISO 文字列で記録 */
export async function insertSetLog(
  sessionId: number,
  log: { exerciseId: number | null; weight: number; reps: number; setOrder: number },
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO set_logs (session_id, exercise_id, weight, reps, set_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    sessionId,
    log.exerciseId,
    log.weight,
    log.reps,
    log.setOrder,
    new Date().toISOString(),
  );
  return result.lastInsertRowId;
}

/**
 * セット1行を部分更新する。patch に渡された項目だけを SET 句に組み立てるので、
 * 「重量だけ」「完了フラグだけ」のような最小限の UPDATE になる。
 * 値はすべて ? のプレースホルダ経由で渡す(SQL インジェクション対策)。
 */
export async function updateSetLogRow(
  id: number,
  patch: { exerciseId?: number | null; weight?: number; reps?: number; completed?: number },
): Promise<void> {
  // 渡された項目だけを "列 = ?" とその値に振り分ける
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
  if (sets.length === 0) return; // 更新対象が無ければ何もしない
  const db = await getDb();
  await db.runAsync(`UPDATE set_logs SET ${sets.join(', ')} WHERE id = ?`, ...values, id);
}

/** セットを1件削除する */
export async function deleteSetLog(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM set_logs WHERE id = ?', id);
}

/** セッション内の特定種目のセットを一括削除。null は exercise_id IS NULL を対象にする */
export async function deleteSetLogsByExercise(
  sessionId: number,
  exerciseId: number | null,
): Promise<void> {
  const db = await getDb();
  if (exerciseId === null) {
    await db.runAsync(
      'DELETE FROM set_logs WHERE session_id = ? AND exercise_id IS NULL',
      sessionId,
    );
  } else {
    await db.runAsync(
      'DELETE FROM set_logs WHERE session_id = ? AND exercise_id = ?',
      sessionId,
      exerciseId,
    );
  }
}

/** セッション内の特定種目のセットを別種目に付け替える。from が null は IS NULL を対象にする */
export async function changeSetLogsExercise(
  sessionId: number,
  from: number | null,
  to: number,
): Promise<void> {
  const db = await getDb();
  if (from === null) {
    await db.runAsync(
      'UPDATE set_logs SET exercise_id = ? WHERE session_id = ? AND exercise_id IS NULL',
      to,
      sessionId,
    );
  } else {
    await db.runAsync(
      'UPDATE set_logs SET exercise_id = ? WHERE session_id = ? AND exercise_id = ?',
      to,
      sessionId,
      from,
    );
  }
}

/** セッションのメモを取得。未設定(null)は空文字を返す */
export async function getSessionNote(sessionId: number): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ note: string | null }>(
    'SELECT note FROM workout_sessions WHERE id = ?',
    sessionId,
  );
  return row?.note ?? '';
}

/** セッションのメモを上書き保存する */
export async function updateSessionNote(sessionId: number, note: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE workout_sessions SET note = ? WHERE id = ?', note, sessionId);
}

/** カスタム種目を追加。is_default=0、sort_order は既存の最大値+1 */
export async function insertExercise(name: string, bodyPart: string | null): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ maxOrder: number | null }>(
    'SELECT MAX(sort_order) AS maxOrder FROM exercises',
  );
  const sortOrder = (row?.maxOrder ?? -1) + 1;
  const result = await db.runAsync(
    'INSERT INTO exercises (name, body_part, is_default, sort_order) VALUES (?, ?, 0, ?)',
    name,
    bodyPart,
    sortOrder,
  );
  return result.lastInsertRowId;
}

/**
 * beforeDate より前の、その種目を実施した直近日の全セットを返す。
 * weight>0 または reps>0 のセットがある日を「実施日」とみなす。
 */
export async function getLastPerformance(
  exerciseId: number,
  beforeDate: string,
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
    beforeDate,
  );
  if (!dateRow) return null;
  const sets = await db.getAllAsync<{ weight: number; reps: number }>(
    `SELECT l.weight AS weight, l.reps AS reps
       FROM set_logs l
       JOIN workout_sessions s ON s.id = l.session_id
      WHERE l.exercise_id = ? AND s.date = ? AND (l.weight > 0 OR l.reps > 0)
      ORDER BY l.set_order, l.id`,
    exerciseId,
    dateRow.date,
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
    beforeDate,
  );
  return Math.round(row?.best ?? 0);
}

/** beforeDate より前で、セットを1件以上持つ直近セッションの総ボリューム */
export async function getPreviousSessionVolume(
  beforeDate: string,
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
    beforeDate,
  );
  if (!row) return null;
  return { date: row.date, volume: row.volume ?? 0 };
}

/**
 * 履歴一覧用に、各セッションを1行へ集計して date 降順で返す。
 * - JOIN set_logs: セットを1件も持たないセッションは結果から除外される(空の日を出さない)
 * - LEFT JOIN exercises: 種目未選択(exercise_id IS NULL)のセットも残すため LEFT にする
 * - volume=総重量, setCount=セット数, exerciseNames=その日の種目名をカンマ連結
 */
export async function listRecentSessions(limit: number): Promise<
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
    limit,
  );
}

/** 指定月(monthPrefix 例: '2026-06')の、セットを持つセッション数と総ボリューム */
export async function getMonthlyStats(
  monthPrefix: string,
): Promise<{ sessions: number; volume: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ sessions: number; volume: number | null }>(
    // date は 'YYYY-MM-DD' なので 'YYYY-MM' で前方一致(LIKE 'YYYY-MM%')すれば当月分に絞れる
    `SELECT COUNT(DISTINCT s.id) AS sessions, SUM(l.weight * l.reps) AS volume
       FROM workout_sessions s
       JOIN set_logs l ON l.session_id = s.id
      WHERE s.date LIKE ? || '%'`,
    monthPrefix,
  );
  return { sessions: row?.sessions ?? 0, volume: row?.volume ?? 0 };
}
