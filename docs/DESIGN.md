# BeatLift 設計書

> 筋トレのセットを「その場で」記録するための iOS / Android アプリ。
> ジムでスマホ片手に、種目・重量・レップ数をサッと打ち込み、インターバルを計り、前回との比較を見ながらトレーニングすることを目的とする。

この設計書は **実装から起こしたリバース設計書** です（コードが正、本書が説明）。実装を変えたら本書も更新してください。

---

## 1. コンセプト / 想定ユーザー

- **対象**: 課金してまで多機能なアプリを使う気はないが、トレーニングで **筋力・筋肉量をしっかり伸ばしたい** カジュアル層。自分のトレーニングを毎回記録したい個人ユーザー。
  - → 無料で完結し、シンプルで迷わない作りを優先する（過剰な機能・課金導線は持ち込まない）。
- **使う場面**: ジムでのトレーニング中。手早い入力・オフライン動作・インターバル計測が最優先
- **データはすべて端末内（SQLite）に保存**。サーバー・ログイン・通信は無い（完全オフライン）

### 大切にする3つの価値

判断に迷ったときは、この優先順位に沿って決める。

1. **簡単で速い UI/UX** … トレーニングの合間に迷わず最速で入力できること。タップ数・待ち時間を最小化する。
2. **豊富な便利機能** … 前回比・推定1RM・重量の自動引き継ぎ・インターバル自動開始など、記録を支える機能を充実させる。
3. **高い信頼性** … 記録が消えない・ズレない。オフラインでも確実に保存し、データの整合を守る。

### 主な機能

- 日付ごとのトレーニング記録（1日 = 1セッション）
- 種目を選んでセット（重量×レップ）を追加・編集・削除
- 同じ種目のセットはカード単位でグループ表示
- セット完了チェック → 自動でインターバルタイマー開始
- 前回の同種目の実績・推定1RM（最大挙上重量の目安）を表示
- セッションごとのメモ
- 週カレンダーで日付移動／履歴一覧で過去セッションを振り返り
- 部位別のデフォルト種目23個をプリセット＋カスタム種目追加

---

## 2. 技術スタック

| 領域           | 採用技術                                             | 備考                     |
| -------------- | ---------------------------------------------------- | ------------------------ |
| フレームワーク | Expo SDK 54 / React Native 0.81                      | New Architecture 有効    |
| 言語           | TypeScript 5.9                                       |                          |
| ルーティング   | expo-router 6（ファイルベース）                      | typedRoutes 有効         |
| 状態管理       | Zustand 5                                            | 単一ストア               |
| 永続化         | expo-sqlite 16                                       | WAL モード・外部キー有効 |
| スタイリング   | NativeWind 4（Tailwind 記法）                        | `className` で記述       |
| アニメーション | react-native-reanimated 4                            | ヘッダー折りたたみ等     |
| その他         | expo-haptics（触覚）, @expo/vector-icons（アイコン） |                          |

---

## 3. アーキテクチャ（3層）

```
┌───────────────────────────────────────────────┐
│  画面 (app/)  +  部品 (components/)              │  ← 見た目・操作
│      ・ユーザー操作を受け取る                      │
│      ・ストアの値を表示する                        │
└───────────────────────────────────────────────┘
                    ↓ 読む / 呼ぶ
┌───────────────────────────────────────────────┐
│  状態管理 (store/workoutStore.ts)               │  ← 司令塔
│      ・アプリの「今の状態」を保持                   │
│      ・操作に応じて state を更新し、DB にも書く      │
└───────────────────────────────────────────────┘
                    ↓ 呼ぶ
┌───────────────────────────────────────────────┐
│  データ層 (lib/db.ts) + 計算 (lib/date, lib/rm) │  ← 土台
│      ・SQLite への読み書き（リポジトリ関数）         │
│      ・日付・1RM などの純粋な計算                   │
└───────────────────────────────────────────────┘
```

**基本ルール**: 画面は DB を直接触らず、原則ストア経由で操作する。
（例外: 履歴画面は読み取り専用の集計を `lib/db.ts` から直接呼んでいる）

---

## 4. ディレクトリ構成

```
BeatLift/
├── app/                      画面（expo-router がそのままルートにする）
│   ├── _layout.tsx           アプリ全体の最外枠（ジェスチャ／ステータスバー）
│   └── (tabs)/
│       ├── _layout.tsx       下部タブ定義（ホーム / 履歴）
│       ├── index.tsx         ホーム = 記録画面
│       └── history.tsx       履歴画面
├── components/               画面を構成する UI 部品（9個）
├── store/
│   └── workoutStore.ts       Zustand ストア（唯一の状態の置き場）
├── lib/
│   ├── db.ts                 SQLite スキーマ＋リポジトリ関数
│   ├── date.ts               'YYYY-MM-DD' 日付ユーティリティ（純関数）
│   └── rm.ts                 推定1RM計算（Epley 式・純関数）
├── assets/                   アイコン・スプラッシュ画像
├── app.json                  Expo 設定（名前・アイコン・プラグイン）
└── docs/DESIGN.md            本書
```

---

## 5. データ設計（SQLite）

DB名 `beatlift.db` / 現行スキーマバージョン **2**（`lib/db.ts` の `DATABASE_VERSION`）。

### テーブル

#### `exercises`（種目マスタ）

| 列         | 型         | 説明                             |
| ---------- | ---------- | -------------------------------- |
| id         | INTEGER PK |                                  |
| name       | TEXT       | 種目名（例: ベンチプレス）       |
| body_part  | TEXT?      | 部位（胸・背中・脚・肩・腕・腹） |
| is_default | INTEGER    | 1=プリセット種目, 0=ユーザー追加 |
| sort_order | INTEGER    | 表示順                           |

- 起動時、初回のみ `DEFAULT_EXERCISES`（23種目）をシード投入。

#### `workout_sessions`（1日のトレーニング）

| 列                    | 型          | 説明                                            |
| --------------------- | ----------- | ----------------------------------------------- |
| id                    | INTEGER PK  |                                                 |
| date                  | TEXT UNIQUE | 'YYYY-MM-DD'。**1日1セッション**（UNIQUE 制約） |
| started_at / ended_at | TEXT?       | 予約列（現状ほぼ未使用）                        |
| note                  | TEXT?       | その日のメモ                                    |

#### `set_logs`（1セット = 1行）

| 列          | 型          | 説明                                                   |
| ----------- | ----------- | ------------------------------------------------------ |
| id          | INTEGER PK  |                                                        |
| session_id  | INTEGER FK  | → sessions（ON DELETE CASCADE）                        |
| exercise_id | INTEGER FK? | → exercises。**NULL 可**（種目未選択の下書き行を許す） |
| weight      | REAL        | 重量(kg)                                               |
| reps        | INTEGER     | レップ数                                               |
| set_order   | INTEGER     | セッション内の並び順                                   |
| completed   | INTEGER     | 0/1（完了チェック）                                    |
| created_at  | TEXT        | ISO 文字列                                             |

### リレーション図

```
exercises 1 ──< set_logs >── 1 workout_sessions
            (exercise_id)   (session_id, CASCADE削除)
```

### マイグレーション方針（`migrateDbIfNeeded`）

- `PRAGMA user_version` を見て、現行版未満なら段階的に更新。
- v0（新規）→ 最新スキーマで一括 CREATE ＆ シード。
- v1 の既存 DB → `set_logs.completed` 列を ALTER で追加。

### 派生値・集計（DB 側で計算）

- **総ボリューム** = Σ(weight × reps)
- **推定1RM（E1RM, Epley 式）** = reps=1 なら weight、それ以外 `weight × (1 + reps/30)`
  - `lib/rm.ts`（画面表示用）と `lib/db.ts` の `getBestE1RM`（過去最大の集計用）に同じ式がある
- 履歴の集計（月次回数・総量、直近セッション一覧）は SQL の集計関数で算出

---

## 6. 状態管理（`store/workoutStore.ts`）

単一の Zustand ストア。**「表示中の1日分の状態」**を中心に持つ。

### 主な state

| キー              | 意味                                                              |
| ----------------- | ----------------------------------------------------------------- |
| selectedDate      | 表示中の日付 'YYYY-MM-DD'（初期=今日）                            |
| sessionId         | その日のセッションID                                              |
| exercises         | 種目マスタ一覧                                                    |
| setLogs           | 表示中セッションのセット配列                                      |
| note              | 表示中セッションのメモ                                            |
| prevSession       | selectedDate より前の直近セッション（前回比表示用）               |
| historyByExercise | 種目ごとの「前回実績＋自己ベスト1RM」キャッシュ（日付切替で破棄） |
| restTimer         | インターバルタイマー `{ endsAt, totalSec }`（null=非稼働）        |

### 主な action

- `init` … 起動時：種目ロード → 今日のセッションロード
- `loadSession(date)` … 日付のセッションを取得（無ければ作成）し state を差し替え
  - **連打対策**: 非同期完了時に `selectedDate` が変わっていたら結果を破棄
- `addSetForExercise` … 種目にセット追加（**直前の同種目のセットから重量/レップを引き継ぐ**）
- `updateSetLog` … 入力のたびに呼ばれる。**先に state を更新（即時反映）してから DB 書き込み**（楽観的更新）
- `toggleSetCompleted` … 完了トグル。未完了→完了かつ内容ありの時だけインターバル自動開始
- `removeSetLog` / `removeExerciseGroup` / `changeGroupExercise` … 削除・種目付替
- `saveNote` / `addCustomExercise`
- `startRestTimer` / `adjustRestTimer` / `stopRestTimer` … タイマー操作（既定90秒）

### 派生セレクタ（純関数）

- `selectTotalVolume` / `selectTotalSets` / `selectCompletedSets`
- `groupSetLogs(setLogs)` … exercise_id ごとに出現順でグループ化（カード表示の素）

---

## 7. 画面設計

### ナビゲーション

```
RootLayout (app/_layout.tsx)
  └─ Stack
       └─ (tabs)/_layout.tsx  下部タブ
            ├─ index    「ホーム」(barbell アイコン)
            └─ history  「履歴」  (calendar アイコン)
```

### ① ホーム = 記録画面（`app/(tabs)/index.tsx`）

トレーニング中のメイン画面。構成:

- **CollapsingHeader** … 週カレンダー＋日付＋総重量＋前回比。スクロールで折りたたむ
- **SetLogList** … セットを種目カード（ExerciseGroupCard）で縦に並べる本体
- **RestTimerBar** … インターバル稼働中だけ下部に出るタイマーバー
- **AddSetFab** … 右下 + ボタン → 種目選択シートを開く
- **ExercisePickerSheet** … 種目選択モーダル（追加 / 既存グループの種目変更を兼ねる）
- **NoteModal** … その日のメモ編集

`picker` の状態で「新規追加(add)」か「種目変更(change)」かを区別する。

### ② 履歴画面（`app/(tabs)/history.tsx`）

- 画面表示のたび（`useFocusEffect`）に直近100セッションと今月の集計を読み込み
- セッションをタップ → `loadSession(date)` してホームへ遷移（過去日を編集できる）
- 各行: 日付・総重量・セット数・メモ有無アイコン・種目名
- **この画面だけは `lib/db.ts` の読み取り集計を直接呼ぶ**（書き込みはしない）

---

## 8. コンポーネント一覧（`components/`）

| 部品                | 役割                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| AddSetFab           | 右下のフローティング + ボタン（種目追加トリガ）                        |
| CollapsingHeader    | スクロール連動で折りたたむヘッダー（reanimated）。日付・総重量・前回比 |
| WeekCalendarStrip   | 週7日の日付選択ストリップ                                              |
| SetLogList          | setLogs をグループ化して縦リスト表示。スクロール量を scrollY に流す    |
| ExerciseGroupCard   | 1種目分のカード。種目名・前回実績・各セット行・セット追加・削除        |
| SetRow              | 1セット行。重量/レップ入力・完了チェック・推定1RM 表示・削除           |
| ExercisePickerSheet | 種目選択モーダル。部位チップで絞り込み・検索・カスタム種目追加         |
| RestTimerBar        | インターバルの残り時間表示・±調整・終了。完了時に触覚フィードバック    |
| NoteModal           | その日のメモを編集して保存                                             |

### 代表的なデータの流れ（例: セットを1つ記録する）

```
[+ FAB] → ExercisePickerSheet で種目選択
  → store.addSetForExercise(exerciseId)
      → lib/db.insertSetLog(...)   (DBへINSERT)
      → setLogs に1件追加（即UI反映）
  → SetRow で重量/レップ入力
      → store.updateSetLog(...)  → state即更新 → lib/db.updateSetLogRow(...)
  → 完了チェック
      → store.toggleSetCompleted(...) → RestTimer自動開始 → RestTimerBar表示
```

---

## 9. 設計上の判断メモ（なぜそうなっているか）

- **1日1セッション（date UNIQUE）**: 「その日のトレーニング」という粒度が自然で、日付から一意に開ける。
- **exercise_id を NULL 可**: 種目未選択のまま行を作れるようにし、後から種目を付け替えられる。
- **楽観的更新**: 入力のたびに DB を待つと総重量表示などがもたつくため、先に state を更新。
- **重量/レップの引き継ぎ**: 同種目で複数セット組むのが普通なので、追加時に前セット値をコピー。
- **オフライン完結 / サーバーなし**: ジムでの利用が前提のため、通信に依存しない。

---

## 10. 既知の制約 / 今後の余地

- `started_at` / `ended_at` 列は用意済みだが現状ほぼ未使用（所要時間表示などに拡張可）。
- バックアップ／別端末同期の手段が無い（端末ローカルのみ）。
- 種目の編集・削除・並べ替え UI は未実装（追加のみ）。
- テストコードは未整備。
