# Rikyu Implementation TODO

## Phase 0: Foundation

Phase 0 のゴール: 水屋先行フローで Claude と Codex を協働させ、Rikyu として一つの出力に統合できることを証明する。

### Step 0: Project scaffolding

- [x] TypeScript + Node.js プロジェクト初期化（package.json, tsconfig.json）
- [x] Vitest セットアップ
- [x] Zod 導入
- [x] CLI フレームワーク選定・導入（commander / yargs 等）
- [x] ESLint + Prettier セットアップ
- [x] src/ ディレクトリ構成の作成
- [x] `rikyu` コマンドのエントリポイント（src/index.ts）
- [x] ビルド・実行スクリプトの整備

### Step 1: Provider layer（CLI サブプロセス管理）

- [x] `providers/types.ts` — 共通型定義（ProviderResult, ProviderError 等）
- [x] `providers/claude-cli.ts` — Claude Code CLI のサブプロセス起動・stdout/stderr 収集・JSON パース
- [x] `providers/codex-cli.ts` — Codex CLI のサブプロセス起動・stdout/stderr 収集・JSON パース
- [x] spawn のタイムアウト処理
- [x] ENOENT（CLI 未インストール）のエラーハンドリング
- [x] 非ゼロ exit code のエラーハンドリング
- [x] stdout チャンク分割到着時のバッファリング
- [x] テスト: providers の全テストケース（正常、ENOENT、exit code、タイムアウト、チャンク分割、stderr 混在、シグナル終了）

### Step 2: MizuyaResponse schema

- [x] `mizuya/schema.ts` — MizuyaFinding, MizuyaResponse の Zod スキーマ定義
- [x] `mizuya/parse.ts` — Codex CLI の生出力から JSON を抽出しパースする処理（JSON 前のテキスト混入対応含む）
- [x] テスト: MizuyaResponse の全テストケース（正常、フィールド欠損、未知フィールド、空 findings、不正値、テキスト混入、切り詰め JSON）

### Step 3: Config

- [x] `config/schema.ts` — 設定スキーマの Zod 定義（mode, verbose, json, progress）
- [x] `config/loader.ts` — グローバル設定の読み込み（~/.config/rikyu/config.json）
- [x] `config/loader.ts` — プロジェクト設定の読み込み（.rikyu/config.json）
- [x] `config/loader.ts` — グローバル + プロジェクト設定のマージ（プロジェクト優先）
- [x] `config/loader.ts` — 設定ファイル不在時のデフォルト値
- [x] `config/wizard.ts` — 対話型設定 UI（inquirer スタイル）
- [x] `cli/config.ts` — `rikyu config` コマンド（対話型起動）
- [x] `cli/config.ts` — `rikyu config set <key> <value>` コマンド
- [x] `cli/config.ts` — `rikyu config get <key>` コマンド
- [x] `cli/config.ts` — `rikyu config list` コマンド
- [x] テスト: config の全テストケース（デフォルト値、読み込み、マージ、部分設定、不正 JSON、不正値、set/get）

### Step 4: Status

- [x] `cli/status.ts` — `rikyu status` コマンド
- [x] Claude CLI の存在確認（which / where）
- [x] Codex CLI の存在確認
- [x] Claude CLI のバージョン取得
- [x] Codex CLI のバージョン取得
- [x] Claude CLI の認証チェック
- [x] Codex CLI の認証チェック
- [x] 設定ファイルのバリデーション表示
- [x] 現在の設定値表示
- [x] テスト: status の全テストケース（全正常、Claude 不在、Codex 不在、認証失敗、設定不正）

### Step 5: Mizuya prompt & teishu prompt

- [x] `mizuya/prompt.ts` — Codex 向けプロンプト構築（diff/ファイル内容 + MizuyaResponse スキーマ指示）
- [x] `teishu/constraints.ts` — 和敬清寂の振る舞い制約を構造化データとして定義
- [x] `teishu/prompt.ts` — Claude 向けプロンプト構築（ユーザー依頼 + MizuyaResponse + 振る舞い制約）

### Step 6: Collaboration flow

- [x] `collaboration/flow.ts` — 水屋先行フローの実装（Codex → Claude の順序制御）
- [x] `collaboration/degraded.ts` — degraded mode の実装（Codex 不在時の Claude 単独続行）
- [x] degraded 時の stderr ログ出力
- [x] degraded 時の JSON 出力への degraded フラグ追加
- [x] テスト: collaboration flow の全テストケース（正常フロー、Codex 結果引き渡し、degraded mode、degraded フラグ、stderr 記録）

### Step 7: Output layer

- [x] `output/text.ts` — テキスト出力（Claude の自然言語出力をそのまま表示）
- [x] `output/streaming.ts` — ストリーミング出力（進捗表示: Reading..., Consulting mizuya...）
- [x] テスト: output の基本テストケース（テキスト出力）

### Step 8: Session management

- [x] `session/brief.ts` — SessionBrief の型定義
- [x] `session/context.ts` — コンテキスト収集（diff, ファイル内容, git 情報）
- [x] `session/store.ts` — セッションスナップショットの保存（.rikyu/sessions/<id>.json）
- [x] `session/store.ts` — セッションスナップショットの復元
- [x] `session/store.ts` — セッション一覧の取得
- [x] `session/cache.ts` — MizuyaResponse キャッシュ（mtime ベース invalidation）
- [x] テスト: session の全テストケース（保存、復元、ラウンドトリップ、破損ファイル、一覧、存在しないセッション）
- [x] テスト: cache の全テストケース（ヒット、ミス、不在、ファイル削除）

### Step 9: Core commands — review & ask

- [x] `cli/review.ts` — `rikyu review` コマンド（working-tree diff をレビュー）
- [x] `cli/review.ts` — `rikyu review --staged` オプション
- [x] `cli/review.ts` — `rikyu review <path>` 引数
- [x] `cli/ask.ts` — `rikyu ask "<question>"` コマンド
- [x] 各コマンドが水屋先行フローを通るように配線
- [x] 各コマンドが config の mode, verbose, progress を尊重するように配線

### Step 10: Interactive session & slash commands

- [x] `cli/repl.ts` — `rikyu` 引数なし起動で対話セッションに入る
- [x] `cli/slash.ts` — スラッシュコマンドのパース（`/command [prompt]` 形式）
- [x] `/help` — コマンド一覧表示
- [x] `/exit` — セッション終了
- [x] `/review [prompt]` — review 開始（task 確定、分類スキップ）
- [x] `/ask [prompt]` — ask 開始（task 確定、分類スキップ）
- [x] `/debug [prompt]` — debug 開始（Phase 0 では stub / エラーメッセージ）
- [x] `/fix [prompt]` — fix 開始（Phase 0 では stub / エラーメッセージ）
- [x] `/resume` — 過去のセッションを選んで再開
- [x] `/sessions` — 保存済みセッション一覧
- [x] `/status` — 環境状態を表示
- [x] `session/brief.ts` — 自然言語発話からの SessionBrief 生成（Claude による分類）
- [x] タスク種別に基づく水屋振り分けロジック（review/debug/explain → 通す、fix/会話 → 通さない）
- [x] スラッシュコマンド時の分類スキップ
- [x] セッションの自動保存（各ターン後にスナップショット更新）
- [x] `rikyu --resume` CLI オプション
- [x] テスト: slash commands の全テストケース（コマンドのみ、コマンド+プロンプト、未知コマンド、空入力、スラッシュなし）
- [x] テスト: task routing の全テストケース（review→通す、debug→通す、explain→通す、fix→通さない、会話→通さない、スラッシュ→分類スキップ）

### Step 11: Integration verification

- [x] `rikyu review` の end-to-end 動作確認（モック CLI）
- [x] `rikyu ask` の end-to-end 動作確認（モック CLI）
- [x] 対話セッションの基本フロー確認（モック CLI）
- [x] degraded mode の動作確認
- [x] セッション保存 → resume の動作確認
- [x] Quick ask/review が max 12s 以内で返ることの確認（performance budget）

---

## Phase 1: Unified CLI agent

Phase 1 のゴール: Rikyu が読む・考える・動くの 3 ループを、ローカル CLI で一貫して提供できるようにする。

### Step 12: debug command

- [ ] `cli/debug.ts` — `rikyu debug "<symptom>"` コマンド
- [ ] debug 向け mizuya プロンプト（症状 → 仮説 → 確認手順を求める）
- [ ] debug 向け teishu プロンプト（水屋の仮説と自らの見解を突き合わせる）
- [ ] `/debug [prompt]` スラッシュコマンドの stub 解除
- [ ] テスト: debug の水屋振り分けが正しく動く

### Step 13: fix command

- [ ] `cli/fix.ts` — `rikyu fix --plan` コマンド（修正計画のみ返す）
- [ ] `cli/fix.ts` — `rikyu fix <path> --plan` コマンド
- [ ] `cli/fix.ts` — `rikyu fix --patch` コマンド（差分を提示、CLI 承認機構に委ねる）
- [ ] `cli/fix.ts` — `rikyu fix --apply` コマンド（承認後に変更適用）
- [ ] `collaboration/change-size.ts` — 変更規模推定ロジック
- [ ] 変更規模に基づく実行者選択（小→Claude、大→Codex）
- [ ] `/fix [prompt]` スラッシュコマンドの stub 解除
- [ ] テスト: fix の各モード（plan, patch, apply）の基本動作
- [ ] テスト: 変更規模推定と実行者選択

### Step 14: Mode auto-selection

- [ ] `session/mode.ts` — collaboration mode の自動選択ロジック（Quick / Standard / Deep）
- [ ] `--quick` / `--deep` CLI フラグによる上書き
- [ ] config の mode 設定との統合（CLI フラグ > config > 自動選択）
- [ ] テスト: mode 自動選択の各ケース

### Step 15: Variable-turn deliberation

- [ ] Claude が「水屋に追加質問が必要」と判断した場合の追加ターンフロー
- [ ] mode に基づくターン上限の適用（Quick:1, Standard:2, Deep:3）
- [ ] 追加ターンの結果を Claude に再度渡すループ処理
- [ ] テスト: 追加ターンフローの基本動作

### Step 16: Output options

- [ ] `output/json.ts` — `--json` 出力（degraded フラグ、findings、metadata 含む）
- [ ] `--verbose` 出力（provider 情報、deliberation summary）
- [ ] `output/redaction.ts` — privacy-safe redaction（API キー、トークン等の自動マスク）
- [ ] テスト: JSON 出力、verbose 出力、redaction

### Step 17: REPL continuation

- [ ] 対話セッション内で review → fix に連続して進む流れ
- [ ] 前のターンの結果（MizuyaResponse、findings）を次のターンで参照可能にする
- [ ] キャッシュの活用（review 結果を fix で再利用）
- [ ] テスト: 連続ターンでのキャッシュ再利用

---

## Phase 2: Guided change

Phase 2 のゴール: 承認付き変更適用の品質を上げ、再確認と失敗時対応を整える。

### Step 18: Re-review after patch

- [ ] fix --apply 後に自動で re-review を実行する仕組み
- [ ] re-review の結果を前回のレビュー結果と比較する
- [ ] 新たな問題が見つかった場合のユーザー通知

### Step 19: Rollback guidance

- [ ] fix --apply が失敗した場合のロールバック手順の提示
- [ ] git stash / git checkout による復元ガイダンス
- [ ] 変更適用前の状態を記録する仕組み

### Step 20: Richer change verification

- [ ] 変更適用後のテスト実行提案
- [ ] 変更が依存範囲に与える影響の分析
- [ ] 変更前後の diff サマリー

---

## Phase 3: Team surface

Phase 3 のゴール: ローカルで成立した体験を、チーム運用に持ち込む。

### Step 21: SARIF output

- [ ] MizuyaResponse → SARIF v2.1.0 変換ロジック
- [ ] `--sarif` CLI フラグ
- [ ] SARIF 出力のバリデーション（GitHub Code Scanning 互換性確認）

### Step 22: CI-friendly mode

- [ ] `--ci` フラグ（非対話、進捗表示なし、exit code で結果を返す）
- [ ] quiet mode（finding がなければ何も出力しない）
- [ ] CI 環境の自動検知（CI=true 環境変数）

### Step 23: GitHub Actions sample

- [ ] GitHub Actions workflow サンプルファイル
- [ ] PR コメントへの結果投稿スクリプト
- [ ] SARIF アップロードの設定例

### Step 24: Policy profiles

- [ ] チーム向け設定プロファイル（厳格モード、寛容モード等）
- [ ] .rikyu/policy.json によるチーム共通ルール定義
- [ ] プロファイルの切り替え機構
