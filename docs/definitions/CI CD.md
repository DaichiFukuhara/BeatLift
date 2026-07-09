---
def-type: consolidated
---

# CI/CD

_CI CD, Continuous Integration / Continuous Delivery, Continuous Integration / Continuous Deployment_

コードの変更を取り込み、テストやビルドで確認し、リリースできる状態まで自動で進める開発の仕組み。
CI は変更の検証、CD は検証済みの変更を配布・反映する流れを担う。手作業を減らし、問題を早く見つけて小さく安全に届けるために使う。

---

# CI

_Continuous Integration, 継続的インテグレーション, CI_

変更をこまめにリポジトリへ統合し、そのたびにテスト・lint・ビルドなどを自動実行して問題を早く見つける考え方／仕組み。
GitHub Actions では PR 作成時や push 時にワークフローを走らせ、`main` に入れる前の品質チェックとして使う。

---

# CD

_Continuous Delivery, Continuous Deployment, 継続的デリバリー, 継続的デプロイ_

CI で確認済みの変更を、リリースや配布に進める仕組み。
Continuous Delivery は「いつでもリリースできる状態」まで自動化し、最終反映は人が判断する。Continuous Deployment は本番などへの反映まで自動で行う。
