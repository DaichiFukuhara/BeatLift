# 概要

CI (Continuous Integration)は変更をリポジトリに反映するまでの過程を表す。
具体的には次のようなフローである。

開発者が変更
　　↓
フォーマットのチェック、テスト
　　↓
管理者またはプロジェクトのメンバーが確認
　　↓
mainにマージ

下3つがCIで実行される内容だ。

# Github Actions

今回Github ActionsではPR作成時またはPR更新時に以下のようなチェックを行っている。

- lint
- format
- type
  これらのチェックを通らなければ実行はできない。

実行内容は.github/workflows/ci.ymlで定義される。
on: いつ実行するか
concurrency: 同時に走れるworkflowの決定
jobs: 何を実行するか

##### 補足

concurrencyは同じPRのAction、同じブランチのActionをどう扱うか決定する。
例えば、連続で2つのPRをしたとき前者のActionが終わっていなければどちらのActionも実行する必要はないため、後者にのみActionを実行するといった感じ。
