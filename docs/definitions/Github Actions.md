---
def-type: consolidated
---

# GitHub Actions

_Github Actions, Actions, workflow_

GitHub 上でテストやビルドなどの処理を自動実行する CI/CD の仕組み。
`.github/workflows/` 配下の YAML ファイルに、いつ実行するか、どの環境で何を実行するかを書く。本リポジトリでは PR や `main` への push 時に品質チェックを走らせる。

---

# lint

_lint check, linter, ESLint_

コードの書き方や避けたいパターンを静的にチェックする処理。
本リポジトリでは `npm run lint` で Expo の lint を実行し、明らかなミスやルール違反を PR の段階で見つける。

---

# format

_format check, formatter, Prettier_

インデント、改行、空白などのコードの見た目をそろえる処理。
GitHub Actions では `npm run format:check` を実行し、Prettier の整形ルールから外れていないかだけを確認する。

---

# type

_typecheck, type check, 型チェック_

TypeScript の型に矛盾がないかを確認する処理。
本リポジトリでは `npm run typecheck` で `tsc --noEmit` を実行し、ファイルを出力せずに型エラーだけを検出する。
