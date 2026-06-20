# package.json 解説

`package.json` 本体には JSON の仕様上コメントが書けないため、ここに注釈付きで内容をまとめる。
（本体を変更したら、このファイルも合わせて更新すること）

{
  "name": "beatlift",
  "main": "expo-router/entry", ==エントリポイント。expo-router が app/ を読み込む==
  "version": "1.0.0",

  ==スクリプト（npm run 名前 で実行）==
  "scripts": {
    ==開発サーバー起動==
    "start": "expo start",                          ==開発サーバー（QR表示）==
    "android": "expo start --android",              ==Android で起動==
    "ios": "expo start --ios",                      ==iOS で起動==
    "web": "expo start --web",                      ==ブラウザで起動==

==メンテナンス==
    "reset-project": "node ./scripts/reset-project.js", ==雛形を初期化（テンプレ由来）==

==品質チェック（CI / GitHub Actions で使用）==
    "lint": "expo lint",            ==ESLint。コードの問題を検出==
    "typecheck": "tsc --noEmit",    ==型チェックのみ（ファイル出力なし）==
    "format:check": "prettier --check ." ==整形崩れの検出（直すのは --write）==
  },

==本番依存（アプリ実行に必要）==
  "dependencies": {
    ==Expo 本体 / ルーティング==
    "expo": "~54.0.34",          ==Expo SDK 本体==
    "expo-router": "~6.0.23",    ==ファイルベースルーティング==
    "expo-constants": "~18.0.13",

==ナビゲーション（タブ等。expo-router の土台）==
    "@react-navigation/native": "^7.1.8",
    "@react-navigation/bottom-tabs": "^7.4.0",
    "@react-navigation/elements": "^2.6.3",

==Expo 機能モジュール==
    "@expo/vector-icons": "^15.0.3", ==アイコン==
    "expo-font": "~14.0.11",         ==フォント読込==
    "expo-haptics": "~15.0.8",       ==触覚フィードバック（タイマー等）==
    "expo-image": "~3.0.11",         ==画像表示==
    "expo-linking": "~8.0.12",       ==ディープリンク==
    "expo-splash-screen": "~31.0.13",==起動スプラッシュ==
    "expo-status-bar": "~3.0.9",     ==ステータスバー制御==
    "expo-symbols": "~1.0.8",        ==SF Symbols==
    "expo-system-ui": "~6.0.9",      ==背景色などのシステムUI==
    "expo-web-browser": "~15.0.11",  ==アプリ内ブラウザ==

 ==データ永続化==
    "expo-sqlite": "~16.0.10",   ==端末内 SQLite（lib/db.ts が使用）==

  ==状態管理==
    "zustand": "^5.0.14",        ==単一ストア（store/workoutStore.ts）==

==UI / スタイリング==
    "nativewind": "^4.2.5",      ==Tailwind 記法を RN の className で使う==

 ==React 本体==
    "react": "19.1.0",
    "react-dom": "19.1.0",       ==Web 出力用==

 ==React Native 基盤==
    "react-native": "0.81.5",
    "react-native-gesture-handler": "~2.28.0", ==ジェスチャ==
    "react-native-reanimated": "~4.1.1",       ==アニメーション（折りたたみヘッダー等）==
    "react-native-worklets": "0.5.1",          ==reanimated が依存==
    "react-native-safe-area-context": "~5.6.0",==セーフエリア==
    "react-native-screens": "~4.16.0",         ==ネイティブ画面最適化==
    "react-native-web": "~0.21.0"              ==Web 対応==
  },

  ==開発依存（ビルド・チェック時のみ）==
  "devDependencies": {
    ==型==
    "typescript": "~5.9.2",
    "@types/react": "~19.1.0",

 ==ビルド==
    "babel-preset-expo": "~54.0.10", ==Expo 用 Babel 設定（SDK と同系列に固定）==

 ==Lint==
    "eslint": "^9.25.0",
    "eslint-config-expo": "~10.0.0",

 ==フォーマット==
    "prettier": "^3.8.4",            ==設定は .prettierrc.json==

 ==CSS==
    "tailwindcss": "^3.4.19"         ==nativewind の土台==
  },

  "private": true ==npm へ公開しない（誤公開防止）==
}

## 補足
- バージョン表記 `~` は **パッチのみ更新**、`^` は **マイナーまで更新**を許可。Expo 系は SDK との整合のため `~` で固定する方針。
- `babel-preset-expo` は Expo SDK と世代を揃える（ズレるとビルドが壊れやすい）。
