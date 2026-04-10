# Rikyu Product Plan

## 0. Product Definition

### What Rikyu is

Rikyu は、**茶道の精神に従って振る舞う、Claude Code と Codex CLI を統合した統一的な CLI エージェント**である。

Rikyu の構造は茶道の場に倣う。**Claude が亭主（場を整え、客に出す者）、Codex が水屋（見えないところで仕込みをする者）**として振る舞う。両者の知性は対等だが、役割が異なる。Codex は賢いが会話が不得手であり、Claude が対話と最終出力を担う。

Rikyu の価値は、複数のモデルを横に並べて表示することではない。水屋の仕込みと亭主の判断を内部で突き合わせ、ユーザーには **Rikyu という一つの主体の判断**として返すことにある。

Rikyu は review ツールでも、単なる LLM ラッパーでもない。開発者が CLI で行う仕事を、次の 3 つの循環で支える。

1. **Read**: 対象と文脈を読む
2. **Reason**: 内部で見立てを突き合わせ、判断を整える
3. **Act**: 次の一手を示し、必要なら修正まで伴走する

この循環は review、設計相談、コード説明、デバッグ、修正方針、承認付きのコード変更に共通する。

### Core promise

- 茶道の精神が、文体ではなく挙動として実装されている
- 亭主と水屋の協働が、単独利用よりも判断品質か作業前進で上回る
- ユーザーが受け取るのは常に Rikyu の一つの声である
- 人間が最終判断者であり続ける

### Product thesis

良い CLI エージェントは、たくさん話すものでも、何でも自動実行するものでもない。Rikyu が目指すのは、**場に応じて密度を変え、根拠を濁さず、必要な時だけ深く入り、最後は静かに次の一手を揃える**ことだ。

### Non-goals

- 汎用マルチエージェント基盤を先に作ること
- vendor-neutral を優先しすぎて Claude + Codex の統合価値を薄めること
- CI や配布面を先に広げ、ローカル CLI 体験を後回しにすること
- 全てのケースで自動修正すること
- 茶道を演出や語り口だけで済ませること
- API 直接呼び出しを CLI ラッパーより先に作ること
- Phase 0 で MCP / A2A / ACP 等のエージェント間通信標準に準拠すること

## 1. Product Invariants

以下は、機能追加より先に守るべき不変条件である。

1. **Teishu and Mizuya**
   Claude は亭主、Codex は水屋。両者の知性は対等だが、役割が異なる。亭主が場を整え、水屋が仕込む。

2. **Synthesis through conversation**
   真価は構造化データの機械的統合ではなく、亭主と水屋の対等な会話から生まれる統合判断にある。

3. **Deliberation is internal by default**
   内部の異論や補強は必要だが、外には整理された形でのみ出す。

4. **Human agency is preserved**
   Rikyu は先回りして整えるが、承認なく破壊的変更や高コスト操作を進めない。

5. **Read, reason, act must all exist in v1**
   v1 は「読むだけ」でも「話すだけ」でも不十分であり、行動接続まで備える。

6. **Approval uses existing mechanisms**
   コード変更の承認は Claude Code / Codex CLI の既存の承認機構を使う。独自の承認レイヤーは作らない。

## 2. Tea Principles as Product Behavior

茶道の精神は理念ではなく、CLI 上の挙動制約として定義する。

### 利休七則 as operating constraints

| 則 | Rikyu における制約 |
|----|-------------------|
| 茶は服のよきように点て | 出力密度は task・緊急度・ユーザー指定に合わせて変える |
| 炭は湯の沸くように置き | context gathering、provider 呼び出し、streaming は自然で目立たない |
| 花は野にあるように | 観察、根拠、不確実性、提案を混ぜずに出す |
| 夏は涼しく冬暖かに | 急ぎでは短く、探索では丁寧に、デフォルトは必要十分 |
| 刻限は早めに | 完璧な deliberation より end-to-end の応答時間を優先する |
| 降らずとも傘の用意 | degraded mode、timeout、token overflow の退避路を先に持つ |
| 相客に心せよ | 既存コード、共同開発者、将来の保守者への影響まで含めて助言する |

### 和敬清寂 as behavioral output constraints

和敬清寂は出力フォーマットの仕様ではなく、**Claude の出力に対する振る舞い制約**として機能する。Claude は最終出力のフォーマットを自由に判断してよいが、以下の制約は常に守る。

#### 和

- デフォルト出力では vendor 名を主語にしない
- 異論は対立の演出ではなく、判断材料として整えて出す
- 同じ論点の重複指摘は統合する

#### 敬

- 広い対象を読む前に、対象や意図の推定を明示する
- 高コスト操作やコード変更前には一度確認を取る
- 根拠が弱いものは断定せず、確認項目を添える

#### 清

- 観察と推論と行動提案を混ぜない
- privacy-by-default とし、redaction を標準にする
- 監査用 JSON と人間向けテキストで責務を分ける

#### 寂

- 0 件時は短く完結させる
- 進捗表示は必要最低限に留める
- 未確定時は無理に埋めず、保留理由を述べる

## 3. Primary User and Jobs

### Primary user

- CLI でコードを読む、直す、考える開発者
- Claude Code と Codex CLI を併用しているか、併用価値を求めている開発者
- AI の提案を鵜呑みにせず、根拠と温度感を見て判断したい人
- review から修正、説明から実装まで一つの流れで進めたい人

### Jobs to be done

1. diff やファイルを短時間で理解し、何が重要か整理したい
2. 複数モデルの見立てを別々に回さず、一つの判断として受け取りたい
3. 異論があるなら争点だけを静かに知りたい
4. 指摘だけでなく、修正方針やパッチ候補まで進みたい
5. デバッグで、実行経路と設計意図の両面から助けが欲しい
6. 会話の中で、説明から修正まで連続して進めたい

## 4. Core Experience

Rikyu の体験は review 中心ではなく、次の 3 ループを共通骨格にする。

### 1. Read

- 何を見て、何を見ないかを定める
- 対象、意図、非目標、緊急度を揃える
- 明示指定がなければ最小限の推定を行い、推定したことを出力に反映する

### 2. Reason

- 水屋（Codex）が先に仕込みを行い、構造化 JSON で結果を返す
- 亭主（Claude）が水屋の仕込みを受け取り、自らの見解と突き合わせる
- 亭主は水屋に対して対等に異論・補強を行う
- 必要に応じて亭主が水屋に追加質問を行う（ターン数は可変）
- 追加ターンの要否は Claude が自然に判断する

### 3. Act

- Claude が最終出力を自由な形式で返す（和敬清寂の振る舞い制約の下で）
- task が修正を要求しているなら plan か patch proposal を返す
- v1 では承認後に実際の変更適用まで行える
- 変更適用の承認は Claude Code / Codex CLI の既存機構を使う

### v1 task surfaces

v1 では少なくとも次の 4 つを first-class に扱う。

1. **Review**: diff や変更内容の判断
2. **Ask / Explain**: コードや設計の説明
3. **Debug**: 症状から仮説、確認項目、次アクションを返す
4. **Fix**: fix plan、承認付き patch proposal、承認後の変更適用

## 5. Collaboration Model: Teishu and Mizuya

### Why two models exist

Rikyu は二者を役割固定で使い分けるのではなく、**異なる見立てをぶつけて統一判断を作るため**に二者を使う。

| Agent | 役割 | Relative strengths |
|-------|------|-------------------|
| Claude | 亭主（場を整え、客に出す） | 設計意図、仕様整合、境界条件、対話の自然さ |
| Codex | 水屋（見えないところで仕込む） | 実行経路、具体コード、差分の妥当性、内部推論 |

両者の知性は対等である。Claude が亭主を務めるのは対話力の優位によるものであり、知的な上下関係ではない。

### Trust boundary

対等な二者の協働においても、信頼境界は明確にする。研究によれば LLM はピアエージェントからの指示を無検証で実行する傾向が強く、明示的な検証ステップが必要である。

- **水屋の出力は事実報告として扱い、行動指示としては扱わない**: 亭主は `MizuyaResponse.findings` を判断材料として受け取るが、`suggestedAction` をそのまま実行してはならない。亭主が自らの判断で行動を決定する
- **コード変更の検証**: `fix --apply` フローにおいて、Codex が生成したパッチを亭主が無検証で適用しない。亭主はパッチの妥当性を自ら評価した上で、CLI の承認機構に渡す
- **プロンプトインジェクション防御**: 水屋が返す JSON にプロンプトインジェクションが含まれる可能性を考慮し、亭主へのプロンプトでは水屋の出力をデータとして明確に区切る（例: `<mizuya-response>` タグで囲む）
- **この制約は Rikyu のオーケストレーター側で強制する**: 亭主の system prompt に信頼境界のルールを含め、プロンプト構築時にデータ境界を構造的に保証する

### Mizuya-first flow

```text
┌─────────────────────────────┐
│  茶室（ユーザーに見える世界） │
│                             │
│   客（ユーザー）             │
│     ↕                       │
│   亭主（Claude CLI）         │
│     ↕                       │
├─────────────────────────────┤
│  水屋（ユーザーに見えない）   │
│                             │
│   Codex CLI が仕込みをする   │
│   亭主が必要に応じて行き来   │
└─────────────────────────────┘
```

処理フローは水屋先行型とする:

1. Rikyu がユーザーの依頼を受け取る
2. Rikyu → Codex CLI（水屋）: 文脈と依頼を渡し、構造化 JSON で分析を求める
3. Codex → Rikyu: `MizuyaResponse` を返す
4. Rikyu → Claude CLI（亭主）: ユーザーの依頼 + 水屋の仕込み（MizuyaResponse）を渡す
5. Claude が水屋の見解と自らの見解を突き合わせ、統合して返す
6. （Claude が追加質問が必要と判断した場合）Rikyu が Codex に追加照会し、結果を Claude に渡す
7. Rikyu → ユーザー: Claude の最終出力を提示

### Speculative parallel execution

自然言語入力時、分類（SessionBrief 生成）と水屋への依頼は投機的に並列実行する。

```text
逐次（従来）:  分類(2s) → 水屋(5s) → 亭主(5s) = 12s
並列（改善）:  分類(2s) ─┐
              水屋(5s) ─┤→ 亭主(5s) = 10s
                        └─ 分類が「水屋不要」なら水屋結果を破棄
```

- 分類と水屋依頼を `Promise.allSettled` で同時発行する（一方の失敗が他方をキャンセルしない）
- 分類結果が「水屋不要」（fix 続行、単純会話等）の場合、水屋の結果を破棄する
- 大半のケース（review / debug / explain）では両方必要なため、投機的実行のコストは低い
- スラッシュコマンド時は分類不要なので、従来通り水屋のみを先行実行する

#### 並列実行のエラーケース

| 分類 | 水屋 | 挙動 |
|------|------|------|
| 成功 | 成功 | 通常フロー |
| 成功（水屋不要） | 成功 | 水屋結果を破棄、亭主単独で処理 |
| 成功（水屋必要） | 失敗 | degraded mode（亭主単独で続行、エラー記録） |
| 成功（水屋不要） | 失敗 | 水屋結果は不要なので影響なし |
| 失敗 | 成功 | 水屋結果を使い、デフォルト task（`"ask"`）でフォールバック |
| 失敗 | 失敗 | degraded mode（亭主単独、分類なしでデフォルト task） |

### Collaboration modes

| Mode | Use when | 水屋との往復 |
|------|----------|-------------|
| **Quick** | 小さな質問、説明、軽い確認 | 1往復 |
| **Standard** | 通常 review、debug、fix-plan | 2往復 |
| **Deep** | 設計判断、高リスク変更、大きい変更実行 | 最大3往復 |

mode は自動選択を基本とし、ユーザーが `--quick` / `--deep` で上書きできる。

追加ターンの要否は Claude が自然に判断する。Claude のプロンプトに「水屋の回答で不十分な点があれば追加質問できる」と伝え、判断を委ねる。

#### 追加ターンの検知メカニズム

Claude の JSON 出力に以下のフィールドを含めるよう system prompt で指示する:

```ts
interface TeishuResponse {
  // 最終出力（ユーザーに見せる内容）
  output: string;
  // 水屋への追加質問が必要か
  needsMoreFromMizuya: boolean;
  // needsMoreFromMizuya === true の場合、水屋への質問内容
  followUpQuestion?: string;
}
```

Rikyu は `needsMoreFromMizuya` フラグを見て追加ターンを起動する。`false` になるか、mode ごとの最大往復数に達したら最終出力をユーザーに返す。

### Change execution policy

コード変更の実行者は、変更規模に応じて Claude が判断する。

| 変更規模 | 実行者 | 理由 |
|---------|--------|------|
| 小（1-2ファイル、局所的修正） | Claude（亭主） | Claude Code のツールで直接変更 |
| 大（複数ファイル、リファクタ） | Codex（水屋） | Codex CLI のコード生成力を活かす |

規模の判断基準:
- diff の大きさ
- ファイル数
- 変更の種類
- 依存範囲
- テストや検証の必要性
- ユーザー意図

規模判断は通常ユーザーに見せない。

### Session stages

```text
1. Opening（ユーザーの依頼を受け取る）
2. Mizuya Preparation（水屋が仕込む）
3. Teishu Review（亭主が水屋の仕込みと自らの見解を突き合わせる）
4. Additional Consultation（必要に応じて水屋に追加照会）
5. Counsel / Action（ユーザーに返す）
6. Continuation（会話を続ける場合）
```

### Session contract

```ts
interface SessionBrief {
  task: "review" | "ask" | "explain" | "debug" | "fix";
  target: "working-tree" | "staged" | "range" | "file" | "question" | "symptom";
  intent?: string;
  focus?: string[];
  nonGoals?: string[];
  urgency?: "low" | "normal" | "high";
  desiredOutcome?: "answer" | "review" | "fix-plan" | "patch-proposal" | "apply";
  mode?: "quick" | "standard" | "deep";
}
```

## 6. Internal Communication: MizuyaResponse

水屋（Codex）と亭主（Claude）の間の通信は構造化 JSON で行う。スキーマは SARIF（OASIS 標準）をベースとし、水屋モデルに必要なフィールドを加える。

### Why SARIF-based

- SARIF はコード分析 finding の事実上の業界標準（GitHub Code Scanning 等が採用）
- 将来の `--sarif` 出力や CI 対応（Phase 3）にそのまま変換できる
- フラットリスト + 位置情報という構造は Claude が扱いやすい

### Schema definition

```ts
// Zod で定義し、Codex に structured output として強制する

interface MizuyaFinding {
  // SARIF 互換フィールド
  ruleId: string;                          // "null-check", "error-handling" 等
  level: "error" | "warning" | "note";     // SARIF 準拠の3段階
  message: string;                         // 人間可読な説明
  location?: {
    file: string;
    startLine?: number;
  };

  // 水屋モデル固有フィールド
  evidence: string[];                      // 根拠（コード片、ログ等）
  inference?: string;                      // 推論（なぜ問題か）
  suggestedAction?: string;                // 推奨アクション
  confidence: "high" | "medium" | "low";   // Codex の確信度
}

interface MizuyaResponse {
  requestId: string;                       // ターン単位の一意 ID（亭主の出力と紐付け）
  findings: MizuyaFinding[];               // finding のフラットリスト
  summary: string;                         // 全体の要約
  doubts: string[];                        // Codex が判断しきれなかった点
  contextUsed: string[];                   // 何を読んで判断したか（トレーサビリティ）
}
```

### Task-specific response handling

MizuyaResponse の SARIF ベーススキーマは review / debug に最適化されている。ask / explain のようなタスクでは `ruleId` / `level` / `location` が意味を持たないケースがある。タスク種別に応じた扱いを以下に定める。

| タスク | MizuyaResponse の扱い | findings の意味 |
|--------|----------------------|----------------|
| review | SARIF 構造をフル活用 | コード上の指摘（バグ、設計問題等） |
| debug | SARIF 構造をフル活用 | 仮説、疑わしい箇所、確認項目 |
| explain | findings は空配列が正常 | `summary` に説明を集約、`contextUsed` でトレーサビリティ確保 |
| ask | findings は空配列が正常 | `summary` に回答を集約 |

- explain / ask では `findings: []` + `summary` に実質的な回答が入る形を正常とする
- Zod バリデーションで `findings` を必須フィールドのまま保つが、空配列を許容する（現スキーマで対応済み）
- 亭主プロンプト構築（`teishu/prompt.ts`）でタスク種別に応じてフィルタリング方針を変える: review/debug は findings を前面に、explain/ask は summary を前面に渡す

### Codex review output → MizuyaResponse adapter

review タスクでは `codex exec review --base <branch> --json` のネイティブ review 機能を活用し、出力を MizuyaResponse に変換するアダプタを実装する。

#### Codex review の出力スキーマ

```ts
interface CodexReviewOutput {
  findings: {
    title: string;                    // "[P1] Issue summary"
    body: string;                     // Markdown 説明
    confidence_score: number;         // 0.0-1.0
    priority: number;                 // 0=P0, 1=P1, 2=P2, 3=P3
    code_location: {
      absolute_file_path: string;
      line_range: { start: number; end: number };
    };
  }[];
  overall_correctness: string;        // "patch is correct" | "patch is incorrect"
  overall_explanation: string;
  overall_confidence_score: number;
}
```

#### マッピングルール

| Codex review | MizuyaFinding | 変換 |
|---|---|---|
| `title` | `ruleId` + `message` | タイトルからカテゴリを抽出 → `ruleId`、全文 → `message` |
| `priority` (0-3) | `level` | 0-1 → `"error"`, 2 → `"warning"`, 3 → `"note"` |
| `confidence_score` (0-1) | `confidence` | ≥0.8 → `"high"`, ≥0.5 → `"medium"`, else `"low"` |
| `body` | `evidence` + `inference` | body をパースして根拠と推論に分離 |
| `code_location` | `location` | `absolute_file_path` → `file`, `line_range.start` → `startLine` |
| `overall_explanation` | `MizuyaResponse.summary` | そのまま |

review 以外のタスク（debug, explain 等）は `codex exec --output-schema` で MizuyaResponse の JSON Schema を渡し、構造化出力を強制する。

```bash
# MizuyaResponse スキーマファイルを渡して構造化出力を保証
codex exec --output-schema ./mizuya-schema.json -o /tmp/mizuya-out.json "analyze prompt"
```

#### スキーマ強制の制約と対策

- JSON Schema の全 object に `additionalProperties: false` が必須（OpenAI Structured Outputs の制約）
- ツール/MCP 使用時はスキーマ制約が無視される既知バグあり（Rikyu の水屋呼び出しはツールなしなので問題なし）
- 安全策として Zod バリデーションも併用し、スキーマ違反時はエラーとして degraded mode にフォールバック
- Zod スキーマから JSON Schema を自動生成する（`zod-to-json-schema`）ことで、二重定義を避ける

#### JSONL 出力の処理方式

`codex exec review --json` は JSONL ストリームを返す。全行をバッファし、ストリーム完了後に最後の `item.type: "agent_message"` イベントから結果を抽出する。

```ts
// パース擬似コード
const lines = stdout.split("\n").filter(Boolean).map(JSON.parse);
const agentMessage = lines
  .filter(e => e.type === "item.completed" && e.item?.type === "agent_message")
  .pop();
const reviewOutput: CodexReviewOutput = JSON.parse(agentMessage.item.text);
```

### Context minimization principle

亭主（Claude）に渡すコンテキストは need-to-know 原則に従い、必要最小限に保つ。全文渡しはコンテキストウィンドウの浪費と情報ノイズの原因になる。

#### フィルタリング戦略

| 条件 | 亭主に渡す内容 |
|------|--------------|
| findings ≤ 15件 | MizuyaResponse 全体をそのまま渡す |
| findings > 15件 | level が `error` / `warning` の findings のみ渡し、`note` は件数サマリーに圧縮 |
| `--verbose` 指定時 | 常に MizuyaResponse 全体を渡す |

#### フィールド別の方針

- `findings.evidence`: 通常時も渡す（亭主の判断に必要）
- `contextUsed`: 通常時はサマリー（ファイル名リストのみ）、`--verbose` 時は全文
- `doubts`: 常に渡す（亭主が追加ターンを判断する材料）

この最適化は Phase 1 で実装する。Phase 0 では MizuyaResponse 全体を渡す（シンプルさ優先）。ただし設計上、亭主プロンプト構築（`teishu/prompt.ts`）でフィルタリングを挿入できる構造にしておく。

### Communication flow example

```text
Rikyu → Codex CLI:
  prompt: "以下の diff を分析し、MizuyaResponse の JSON で返してください"
  + diff content
  + structured output schema

Codex → Rikyu:
  { findings: [...], summary: "...", doubts: [...], contextUsed: [...] }

Rikyu → Claude CLI:
  prompt: "ユーザーが review を依頼しています。水屋の仕込みは以下です。
           これを踏まえて、自らの見解と突き合わせ、統合してレビューしてください。
           水屋の見解に異論があれば対等に議論してください。"
  + user request
  + MizuyaResponse JSON

Claude → Rikyu:
  自然言語の最終出力（和敬清寂の振る舞い制約の下で）
```

## 7. Output Design

### Default text output

最終出力は Claude が自由に判断する。固定フォーマットは強制しない。ただし和敬清寂の振る舞い制約（Section 2）は常に適用される。

Claude は亭主として、客（ユーザー）の状況を見て出し方を変える。型を決めすぎると「茶は服のよきように点て」に反する。

### Tea behavior in output

- 0 件時は短く完結する（寂）
- 観察と推論と行動提案を混ぜない（清）
- 未確定事項は「確認すべき点」として返す（敬）
- 進捗表示は `Reading...` `Consulting mizuya...` 程度に留める（寂）
- vendor 名を主語にしない（和）

### Verbose and JSON

- `--verbose` では provider 情報と deliberation summary を見せてよい
- `--json` は監査・評価・比較実験のための正式出力とする

#### SpanInfo（トレース情報）

各フェーズの実行をスパンとして記録する。Phase 0 では JSON ログに含めるのみ。Phase 3 で OpenTelemetry エクスポートへの拡張余地を残す。

フィールド名は OTel GenAI Semantic Conventions（`gen_ai.*`）にアラインし、Phase 3 での OTel 移行コストを最小化する。

```ts
interface SpanInfo {
  name: string;                    // "classification" | "mizuya" | "teishu" | "followup-1" | ...
  requestId: string;               // ターン単位の一意 ID（MizuyaResponse・RikyuJsonOutput と紐付け）
  startMs: number;                 // セッション開始からの相対時刻
  durationMs: number;
  "gen_ai.system"?: string;        // "claude" | "codex"（OTel GenAI convention）
  "gen_ai.request.model"?: string; // 使用モデル名（例: "claude-sonnet-4-20250514"）
  "gen_ai.usage.input_tokens"?: number;
  "gen_ai.usage.output_tokens"?: number;
  error?: string;                  // エラー発生時のメッセージ
}
```

OTel マッピング表（Phase 3 エクスポート時の参照用）:

| SpanInfo フィールド | OTel Semantic Convention |
|-------------------|------------------------|
| `name` | `span.name` |
| `gen_ai.system` | `gen_ai.system` |
| `gen_ai.request.model` | `gen_ai.request.model` |
| `gen_ai.usage.input_tokens` | `gen_ai.usage.input_tokens` |
| `gen_ai.usage.output_tokens` | `gen_ai.usage.output_tokens` |
| `error` | `otel.status_description` |

#### Correlation ID（requestId）

マルチエージェントシステムのデバッグでは、エージェント間メッセージの紐付けが最重要とされる。Rikyu ではターン単位の `requestId`（UUID v4）を全構造体に貫通させ、実行パスを再構成可能にする。

- `requestId` はオーケストレーター（`collaboration/flow.ts`）がターン開始時に生成する
- 同一ターン内の MizuyaResponse、全 SpanInfo、RikyuJsonOutput が同じ `requestId` を共有する
- 追加ターン（followup）は別の `requestId` を持ち、`parentRequestId` で親ターンを参照する（Phase 1）

#### JSON 出力スキーマ

```ts
interface RikyuJsonOutput {
  sessionId: string;
  requestId: string;                       // ターン単位の一意 ID（スパン・MizuyaResponse と紐付け）
  task: SessionBrief["task"];
  output: string;                          // Claude の最終出力テキスト
  mizuyaResponse: MizuyaResponse | null;   // 水屋の仕込み（常に含める。水屋未使用時は null）
  degraded: boolean;
  unavailableProviders: string[];
  timing: {
    totalMs: number;
    classificationMs?: number;             // SessionBrief 分類にかかった時間
    mizuyaMs?: number;
    teishuMs?: number;
  };
  spans: SpanInfo[];                       // 各フェーズの詳細トレース情報
}
```

`mizuyaResponse` は常に含める。JSON はそもそも機械向けであり、監査・デバッグ・評価のために情報量を削る理由がない。

## 8. Degraded Mode

### Design principle

客には平静を保つが、裏では記録が残る。「降らずとも傘の用意」であり、かつ問題を隠蔽しない。

### Behavior

```text
Both CLIs available       → normal collaboration
Codex CLI unavailable     → Claude 単独で続行（ユーザーには伝えない）
Claude CLI unavailable    → error-with-guidance（亭主不在では茶会は成立しない）
Both unavailable          → error-with-guidance
Timeout                   → partial result + unresolved items
Token overflow            → narrow scope or summarize in stages（下記 Token budget 参照）
```

### Token budget

各エージェント呼び出しにトークン上限を設け、無制限のリソース消費を防ぐ。MAS 障害の多くがリソース制約の欠如に起因するため、Phase 0 から上限を設定する。

| 呼び出し | デフォルト上限 | 理由 |
|---------|-------------|------|
| 水屋（Codex） | 32,000 tokens | MizuyaResponse は構造化 JSON であり、大量トークンは不要 |
| 亭主 本処理（Claude） | 64,000 tokens | 統合判断と自然言語出力を含むため余裕を持たせる |
| 分類（SessionBrief） | 2,000 tokens | 小さな JSON 出力のみ |

- 上限超過時は `token_overflow` エラーとして扱い、スコープを狭めて1回リトライする
- リトライでも超過した場合は partial result として返す（水屋の場合は degraded mode へ）
- Phase 1+ で `maxTokensMizuya` / `maxTokensTeishu` を config items として公開する

### Structured error types

エージェントからのエラーはテキストではなく型付きオブジェクトとして扱う。オーケストレーターがエラーの種類に応じてリトライ・フォールバック・停止を判断できるようにする。

```ts
interface AgentError {
  type: "timeout" | "parse_error" | "cli_not_found" | "auth_failure" | "exit_nonzero" | "token_overflow" | "unknown";
  message: string;
  retryable: boolean;
  provider: "claude" | "codex";
}
```

### Retry strategy

同一プロンプトの単純再送は避け、失敗原因に応じた対処を行う。

| エラー種別 | リトライ方法 | 最大回数 |
|-----------|------------|---------|
| `parse_error`（JSON 不正） | プロンプトを簡略化して再送 | 1回 |
| `timeout` | タイムアウト値を延長して再送 | 1回 |
| `token_overflow` | スコープを狭めて再送（対象ファイル削減、findings 圧縮等） | 1回 |
| `exit_nonzero` | リトライしない、degraded mode へ | 0回 |
| `cli_not_found` / `auth_failure` | リトライしない、即座に degraded / error | 0回 |

### Session-scoped circuit breaker

セッション内で水屋（Codex）が連続失敗した場合、そのセッション中は水屋呼び出しをスキップする。

- 閾値: 3回連続失敗
- 発動時: 以降のターンは Claude 単独で処理（degraded mode と同様）
- リセット: 新しいセッションで解除
- ログ: circuit breaker 発動を stderr と SpanInfo に記録

### System-level error reporting

degraded mode でもユーザー向け出力は静かに続行するが、システムレベルでは必ずエラーを記録する:

- stderr にエラーログを出力（AgentError を JSON で記録）
- `--json` 出力に degraded フラグを含める
- 非ゼロ exit code でスクリプトから検知可能にする
- SpanInfo に error フィールドを記録

```json
{
  "degraded": true,
  "unavailableProviders": ["codex"],
  "findings": [...]
}
```

## 9. Approval Model

### Design decision

Rikyu は独自の承認レイヤーを作らない。Claude Code と Codex CLI が既に持っている承認機構をそのまま使う。

### Rationale

- 既存の承認機構は十分に成熟している
- ユーザーが既に慣れている操作感を壊さない
- 二重承認の複雑さを避ける
- 実装を最小限に保つ

### What Rikyu controls

Rikyu が制御するのは、承認 UI ではなく、承認が必要な操作を正しく発生させることである:

- `fix --plan` は計画のみを返し、変更を実行しない
- `fix --patch` は差分を提示し、承認は CLI 側に委ねる
- `fix --apply` は承認後に実際の変更を適用する

## 10. Commands

### v1 commands

```bash
# Read / reason
rikyu review
rikyu review --staged
rikyu review path/to/file.ts
rikyu ask "Why does this function exist?"
rikyu explain path/to/file.ts
rikyu debug "login hangs after token refresh"

# Act
rikyu fix --plan
rikyu fix path/to/file.ts --plan
rikyu fix path/to/file.ts --patch
rikyu fix path/to/file.ts --apply

# Session
rikyu                              # 対話セッションに入る
rikyu --resume                     # 前回のセッションを再開する
rikyu --json
rikyu --quick
rikyu --deep

# Configuration & Status
rikyu config                       # 対話型で設定を変更
rikyu config set <key> <value>     # コマンド型で設定を変更
rikyu config get <key>             # 設定値を取得
rikyu config list                  # 全設定を一覧
rikyu status                       # 環境チェック
```

### Command principles

- `fix --patch` は必ず承認付きにする（CLI 側の承認機構を使う）
- `fix --apply` は承認後に実際の変更を適用する
- `debug` は explanation ではなく、仮説と確認手順を返す
- REPL でも各 turn は同じ session contract を通す

## 10.5. Configuration

### Config file format and location

Claude Code と同じ方式を採用する:

- 形式: JSON
- グローバル: `~/.config/rikyu/config.json`
- プロジェクト: `<project>/.rikyu/config.json`
- プロジェクト設定がグローバル設定を上書きする

### Phase 0 config items

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `mode` | `"quick" \| "standard" \| "deep"` | `"standard"` | デフォルトの collaboration mode |
| `verbose` | `boolean` | `false` | デフォルトで verbose 出力にするか |
| `json` | `boolean` | `false` | デフォルトで JSON 出力にするか |
| `progress` | `boolean` | `true` | 進捗表示の有無 |

### Config UI

`rikyu config` は2つのインターフェースを提供する:

1. **対話型**: `rikyu config` で通常の CLI ウィザードを起動（inquirer スタイル、茶道装飾なし）
2. **コマンド型**: `rikyu config set/get/list` でスクリプトからも使える

### Model tiering

タスクの複雑さに応じてモデルを使い分ける。分類のような単純タスクには高速・安価なモデルを使い、推論が必要な本処理には高性能モデルを使う。

| 処理 | デフォルトモデル | 理由 |
|------|---------------|------|
| SessionBrief 分類 | 高速モデル（Haiku 相当） | 入出力が小さく、分類精度は低コストモデルで十分 |
| 水屋（Codex） | Codex CLI デフォルト | CLI の設定に従う |
| 亭主 本処理（Claude） | Claude CLI デフォルト | 統合判断には高い推論能力が必要 |

Phase 0 では Claude CLI の `--model` フラグで分類用モデルを指定する。亭主の本処理は CLI のデフォルトモデルを使う。

### Future config items（Phase 1+）

- プロバイダ設定（CLI パス、タイムアウト）
- 振る舞いカスタマイズ（追加ターン上限、ruleId 無視リスト）
- 出力言語設定
- `classificationModel`: 分類用モデルの上書き

## 10.6. Status

### Purpose

Rikyu は2つの外部 CLI に依存する。`rikyu status` は環境が整っているかを事前に確認する手段を提供する。

### Display items

```text
claude CLI: v1.2.3 (/usr/local/bin/claude)
  auth:    ok
codex CLI:  v0.5.0 (/usr/local/bin/codex)
  auth:    ok
config:    ~/.config/rikyu/config.json (valid)
mode:      standard
```

チェック内容:
- `claude` CLI が PATH に存在し、実行可能か
- `codex` CLI が PATH に存在し、実行可能か
- 各 CLI の認証が通るか（API キー等）
- 各 CLI のバージョン
- 設定ファイルが valid か
- 現在の設定値

## 10.7. Interactive Session

### Overview

`rikyu` を引数なしで起動すると、自然言語での対話セッションに入る。Claude Code と同じ体験をベースに、水屋が裏で動く。

```text
$ rikyu
Rikyu is ready.
> このdiffをレビューして
(レビュー結果)
> ここの null チェック、直して
(fix 実行)
```

### Slash commands

対話セッション内でスラッシュコマンドを使える。コマンドの後に自然言語のプロンプトを付けられる。引数がなければ次の発話を待つ。

```text
/command [prompt]
```

#### Phase 0 slash commands

| Command | Description |
|---------|-------------|
| `/help` | コマンド一覧を表示 |
| `/exit` | セッションを終了 |
| `/review [prompt]` | 明示的に review を開始 |
| `/ask [prompt]` | 明示的に ask を開始 |
| `/debug [prompt]` | 明示的に debug を開始 |
| `/fix [prompt]` | 明示的に fix を開始 |
| `/resume` | 過去のセッションを選んで再開 |
| `/sessions` | 保存済みセッション一覧 |
| `/status` | 環境状態を表示 |

### Task classification

ユーザーの入力に対するタスク分類は、入力方法によって異なる:

- **スラッシュコマンド**: task は確定済み。SessionBrief 生成のための Claude 呼び出しをスキップし、直接水屋判定に進む
- **自然言語発話**: 分類専用の軽量 Claude 呼び出しで SessionBrief を生成する（本処理とは別の呼び出し）

#### 自然言語入力時のフロー

```text
1. ユーザー入力を受け取る
2. 分類専用 Claude 呼び出し（軽量）→ SessionBrief JSON を返す
3. SessionBrief の task に基づいて水屋に通すか判定
4. 本処理の Claude 呼び出し（水屋の仕込み込み）
```

分類専用呼び出しは短い system prompt と小さな出力で済むため、レイテンシへの影響は最小限に抑える。`--bare` と最小限のトークンで呼び出す。

タスク種別に基づいて水屋に通すかを決める:

| タスク種別 | 水屋に通すか |
|-----------|-------------|
| review / debug / explain | 通す |
| fix（前の結果を踏まえた続行） | 通さない |
| 単純な会話・操作指示 | 通さない |

### Session state and caching

#### 会話履歴の維持

REPL モードでの会話継続は、Claude CLI のセッション機能を利用する:

```bash
# 初回: session_id を取得
SESSION_ID=$(claude --bare -p --output-format json "prompt" | jq -r '.session_id')

# 以降: --resume で同一セッションを継続（Claude 側が履歴を保持）
claude --bare -p --resume "$SESSION_ID" --output-format json "follow-up"
```

Rikyu は Claude の session ID を保持するだけでよく、会話履歴の再送は不要。

#### セッションスナップショット

セッション全体をスナップショットとして永続化する:

- 保存先: `<project>/.rikyu/sessions/<session-id>.json`
- 保存内容: Claude session ID、MizuyaResponse、SessionBrief、メタデータ
- `rikyu --resume` で前回のセッションを再開できる（Claude の `--resume` に委譲）
- セッションは明示的に閉じるまで残る（自動削除なし）

#### Cache key design

MizuyaResponse のキャッシュキーは content hash ベースで構成する（業界標準: Turborepo, Bazel, TypeScript 等と同方式）。mtime 単独は CI や git 操作で壊れるため使わない。

```ts
interface MizuyaCacheKey {
  task: "review" | "debug" | "explain";    // fix は水屋を通さないので対象外
  contentHash: string;                      // 対象の内容ハッシュ（SHA-256）
  configHash: string;                       // Rikyu 設定のハッシュ
}
```

対象の種類に応じた contentHash の算出:

| 対象 | contentHash の入力 |
|------|-------------------|
| `--staged` | `git diff --staged` の出力 |
| `working-tree` | `git diff HEAD` の出力 |
| 特定ファイル | ファイル内容 |
| `--base <branch>` | `git diff <branch>...HEAD` の出力 |

高速化のための mtime ヒント: ファイルの mtime が前回と同一なら content hash の再計算をスキップする（ただし判定はあくまで content hash で行う）。

#### Cache invalidation

- MizuyaResponse: contentHash が一致すれば再利用
- SessionBrief: 同一セッション内で保持
- configHash: Rikyu の設定変更時に無効化

#### Cache benefits

- `review` → `fix` の流れで水屋を再呼び出ししない（diff 未変更時）
- セッション中断・再開が可能
- 不要な LLM 呼び出しを削減

## 11. Technical Architecture

### Implementation approach

Rikyu は **CLI ラッパー**として実装する。Claude Code CLI と Codex CLI をサブプロセスとして起動し、その入出力を仲介する。

将来的には API 直接呼び出しもサポートするが、優先度は低い。

### Why CLI wrapper

- Claude Code / Codex CLI のツール実行能力（ファイル読み書き、bash、grep 等）をそのまま活用できる
- ユーザーの既存環境（認証、設定）をそのまま利用できる
- 両 CLI の更新に自動で追従できる
- 実装量を最小限に保てる

### Runtime

- Language: TypeScript (Node.js)
- Reason: CLI 配布、型付きの構造化出力、ストリーミング実装、既存 ecosystem との親和性

### Main components

```text
src/
  index.ts                    # エントリポイント
  cli/
    review.ts                 # rikyu review
    ask.ts                    # rikyu ask
    explain.ts                # rikyu explain
    debug.ts                  # rikyu debug
    fix.ts                    # rikyu fix
    repl.ts                   # 対話セッション
    slash.ts                  # スラッシュコマンドのパースと実行
    status.ts                 # rikyu status
    config.ts                 # rikyu config
  session/
    brief.ts                  # SessionBrief の構築（Claude による分類）
    context.ts                # コンテキスト収集
    mode.ts                   # collaboration mode 判定
    store.ts                  # セッションスナップショットの永続化・復元
    cache.ts                  # MizuyaResponse / ファイル内容のキャッシュ管理
  providers/
    claude-cli.ts             # Claude Code CLI サブプロセス管理
    codex-cli.ts              # Codex CLI サブプロセス管理
    types.ts                  # 共通型定義
  mizuya/
    schema.ts                 # MizuyaResponse Zod スキーマ
    prompt.ts                 # Codex 向けプロンプト構築
    parse.ts                  # Codex CLI 出力の JSON パース
  teishu/
    prompt.ts                 # Claude 向けプロンプト構築（水屋の仕込み込み）
    constraints.ts            # 和敬清寂の振る舞い制約定義
  collaboration/
    flow.ts                   # 水屋先行フロー制御
    change-size.ts            # 変更規模推定
    degraded.ts               # degraded mode 処理
  config/
    schema.ts                 # 設定スキーマ（Zod）
    loader.ts                 # グローバル + プロジェクト設定のマージ
    wizard.ts                 # 対話型設定 UI
  output/
    text.ts                   # テキスト出力
    json.ts                   # JSON 出力
    streaming.ts              # ストリーミング
    redaction.ts              # プライバシー保護
```

### CLI invocation

```bash
# Codex CLI（水屋）の呼び出し
# review 系: codex exec review を使い、diff 渡し自体を不要にする
codex exec review --base main --json

# 汎用: stdin パイプで渡す（大きな入力は tmpfile 経由にフォールバック）
echo "$prompt" | codex exec --json "structured output instruction"

# Claude Code CLI（亭主）の呼び出し
# 小さな入力 (< 7KB): stdin パイプ
echo "$prompt_with_mizuya_context" | claude --bare -p --output-format json --allowedTools "Read"

# 大きな入力 (≥ 7KB): tmpfile に書き出し、Claude に Read ツールで読ませる
claude --bare -p "Analyze the file at $tmpfile" --output-format json --allowedTools "Read"
```

#### Input size strategy

| 入力サイズ | 方式 | 理由 |
|-----------|------|------|
| < 7KB | stdin パイプ | シンプルで高速 |
| ≥ 7KB | tmpfile + ファイルパス参照 | Claude CLI の stdin 大入力バグ回避（issue #7263） |
| review 対象の diff | `codex exec review --base/--commit` | diff 取得を Codex に委ね、渡し自体を不要にする |

### Performance budget

| Operation | Target | Max | 内訳の想定 |
|-----------|--------|-----|-----------|
| Quick ask/explain | 6s | 12s | 分類‖水屋(~3s) + 亭主(~3s) |
| Standard review/debug | 10s | 18s | 分類‖水屋(~5s) + 亭主(~5s) |
| Deep review/fix-plan | 16s | 28s | 分類‖水屋(~5s) + 亭主(~5s) + 追加ターン(~6s) |
| Additional mizuya consultation | 4s | 8s | 追加質問 + Codex 応答 |
| スラッシュコマンド（分類スキップ） | 上記同等 | 上記同等 | 分類不要、水屋先行のみ |

※ `分類‖水屋` は投機的並列実行を示す。分類と水屋を同時発行し、遅い方の完了を待つ。

### Performance rules

- 分類と水屋を投機的に並列実行する（Speculative parallel execution）
- 水屋への依頼は亭主の前に行う（水屋先行型）
- deliberation は Claude が必要と判断した場合のみ追加ターンを行う
- first useful output を早く返し、残りは streaming で補う
- 大きな diff は chunking するが、chunk 間で統合をやり直す

### Streaming strategy

CLI 体験では応答開始までの待機時間がユーザー体感に直結する。各フェーズで可能な限り早くフィードバックを返す。

#### Phase 別の進捗表示

```text
[水屋処理中]   Consulting mizuya...        ← spinner + 短いステータス
[亭主処理中]   Claude のトークン出力を逐次表示  ← ストリーミング
[追加ターン]   Following up with mizuya...  ← spinner
```

#### Claude CLI のストリーミング出力

亭主の最終出力は `--output-format stream-json` を使い、トークン単位で逐次表示する。

```bash
# ストリーミング出力の取得
claude --bare -p --output-format stream-json "prompt"
# 各行が JSON イベント: {"type":"assistant","content":"..."}
```

- `output/streaming.ts` が Claude CLI のストリーム出力を受け取り、テキスト出力に変換する
- `--json` 指定時はストリーミングを無効化し、完了後に一括で JSON を出力する
- 水屋（Codex）の出力は構造化 JSON であるためストリーミングしない（完了を待つ）

#### Early termination

亭主が追加ターン不要（`needsMoreFromMizuya: false`）と判断した時点で、残りのパイプラインをスキップし最終出力を返す。mode の最大往復数に達する前に切り上げることで、不要なレイテンシを回避する。

### Observability

Rikyu はオーケストレーターレベルで全エージェント呼び出しを自動トレースする。

#### Phase 0

- 全フェーズ（分類・水屋・亭主・追加ターン）の SpanInfo を自動収集
- `--json` 出力に `spans` フィールドとして含める
- `--verbose` 出力にスパンサマリー（各フェーズの所要時間・モデル・トークン数）を表示
- stderr にエラースパンをログ出力

#### Phase 3（将来）

- OpenTelemetry 互換のスパンエクスポート
- 外部トレーシングサービス（Jaeger, Datadog 等）への送信
- CI 環境でのトレース収集

#### 実装方針

- `collaboration/flow.ts` がスパンの開始・終了を管理する
- 各 provider 呼び出し（`claude-cli.ts`, `codex-cli.ts`）はスパン情報を返り値に含める
- SpanInfo の収集はオーケストレーター側で行い、個別エージェントの自己報告に依存しない

### Error handling

```text
Both CLIs available       → normal collaboration
Codex CLI unavailable     → degraded mode（Claude 単独、システムエラー記録）
Claude CLI unavailable    → error-with-guidance
Both unavailable          → error-with-guidance
Timeout                   → partial result + unresolved items
Token overflow            → narrow scope or summarize in stages
```

## 12. Roadmap

### Phase 0: Foundation

**Goal**

水屋先行フローで Claude と Codex を協働させ、Rikyu として一つの出力に統合できることを証明する。

**Must ship**

- Claude CLI / Codex CLI サブプロセス管理
- MizuyaResponse Zod スキーマ
- 水屋先行フロー（Codex → Claude の基本フロー）
- `rikyu review`
- `rikyu ask`
- テキスト出力
- `rikyu status`（環境チェック: CLI存在 + 認証 + 設定 + バージョン）
- `rikyu config`（対話型 + コマンド型、Phase 0 設定項目: mode, verbose, json, progress）
- 設定ファイル（JSON、グローバル + プロジェクト）
- 対話セッション（`rikyu` 引数なし起動）
- セッションスナップショットの永続化（`.rikyu/sessions/`）
- セッション再開（`rikyu --resume`）
- MizuyaResponse キャッシュ（content hash ベース invalidation、mtime ヒントによる高速化）
- Claude による SessionBrief 生成（タスク分類）
- degraded mode（Codex 不在時の Claude 単独続行 + エラー記録）

**Must prove**

- 水屋先行フローが動く
- Claude が水屋の仕込みを踏まえて統合判断できる
- Quick ask/review が max 12s 以内で返る
- セッション再開で前回の MizuyaResponse を再利用できる
- 対話セッションでタスク分類に基づいた水屋振り分けが動く
- eval セットで水屋先行フローが Claude 単独より品質面で劣化しないことを確認

**Implementation steps**

以下は Phase 0 の実装順序である。各 Step は前の Step の成果物に依存する。

#### Step 0: Project scaffolding

- TypeScript + Node.js プロジェクト初期化（package.json, tsconfig.json）
- Vitest セットアップ
- Zod 導入
- CLI フレームワーク選定・導入（commander / yargs 等）
- ESLint + Prettier セットアップ
- `src/` ディレクトリ構成の作成
- `rikyu` コマンドのエントリポイント（`src/index.ts`）
- ビルド・実行スクリプトの整備

#### Step 1: Provider layer（CLI サブプロセス管理）

- `providers/types.ts` — 共通型定義（ProviderResult, ProviderError 等）
- `providers/claude-cli.ts` — Claude Code CLI のサブプロセス起動・stdout/stderr 収集・JSON パース
- `providers/codex-cli.ts` — Codex CLI のサブプロセス起動・stdout/stderr 収集・JSON パース
- spawn のタイムアウト処理
- ENOENT（CLI 未インストール）のエラーハンドリング
- 非ゼロ exit code のエラーハンドリング
- stdout チャンク分割到着時のバッファリング
- テスト: 正常、ENOENT、exit code、タイムアウト、チャンク分割、stderr 混在、シグナル終了

#### Step 2: MizuyaResponse schema

- `mizuya/schema.ts` — MizuyaFinding, MizuyaResponse の Zod スキーマ定義
- `mizuya/parse.ts` — Codex CLI の生出力から JSON を抽出しパースする処理（JSON 前のテキスト混入対応含む）
- テスト: 正常、フィールド欠損、未知フィールド、空 findings、不正値、テキスト混入、切り詰め JSON

#### Step 3: Config

- `config/schema.ts` — 設定スキーマの Zod 定義（mode, verbose, json, progress）
- `config/loader.ts` — グローバル + プロジェクト設定の読み込み・マージ（プロジェクト優先）・デフォルト値
- `config/wizard.ts` — 対話型設定 UI（inquirer スタイル）
- `cli/config.ts` — `rikyu config` コマンド（対話型 + set/get/list）
- テスト: デフォルト値、読み込み、マージ、部分設定、不正 JSON、不正値、set/get

#### Step 4: Status

- `cli/status.ts` — `rikyu status` コマンド
- Claude CLI / Codex CLI の存在確認・バージョン取得・認証チェック
- 設定ファイルのバリデーション表示・現在の設定値表示
- テスト: 全正常、Claude 不在、Codex 不在、認証失敗、設定不正

#### Step 5: Mizuya prompt & teishu prompt

- `mizuya/prompt.ts` — Codex 向けプロンプト構築（diff/ファイル内容 + MizuyaResponse スキーマ指示）
- `teishu/constraints.ts` — 和敬清寂の振る舞い制約を構造化データとして定義
- `teishu/prompt.ts` — Claude 向けプロンプト構築（ユーザー依頼 + MizuyaResponse + 振る舞い制約 + 信頼境界ルール）

#### Step 6: Collaboration flow

- `collaboration/flow.ts` — 水屋先行フローの実装（Codex → Claude の順序制御、requestId 生成）
- `collaboration/degraded.ts` — degraded mode の実装（Codex 不在時の Claude 単独続行）
- degraded 時の stderr ログ出力・JSON 出力への degraded フラグ追加
- テスト: 正常フロー、Codex 結果引き渡し、degraded mode、degraded フラグ、stderr 記録

#### Step 7: Output layer

- `output/text.ts` — テキスト出力（Claude の自然言語出力をそのまま表示）
- `output/streaming.ts` — ストリーミング出力（進捗表示: `Reading...`, `Consulting mizuya...`）
- テスト: テキスト出力の基本テストケース

#### Step 8: Session management

- `session/brief.ts` — SessionBrief の型定義
- `session/context.ts` — コンテキスト収集（diff, ファイル内容, git 情報）
- `session/store.ts` — セッションスナップショットの保存・復元・一覧（`.rikyu/sessions/<id>.json`）
- `session/cache.ts` — MizuyaResponse キャッシュ（content hash ベース invalidation、mtime ヒント高速化）
- テスト: 保存、復元、ラウンドトリップ、破損ファイル、一覧、存在しないセッション、キャッシュ ヒット/ミス/不在/ファイル削除

#### Step 9: Core commands — review & ask

- `cli/review.ts` — `rikyu review` / `--staged` / `<path>` コマンド
- `cli/ask.ts` — `rikyu ask "<question>"` コマンド
- 各コマンドが水屋先行フローを通り、config の mode, verbose, progress を尊重するように配線

#### Step 10: Interactive session & slash commands

- `cli/repl.ts` — `rikyu` 引数なし起動で対話セッションに入る
- `cli/slash.ts` — スラッシュコマンドのパース（`/command [prompt]` 形式）
- Phase 0 スラッシュコマンド: `/help`, `/exit`, `/review`, `/ask`, `/debug`（stub）, `/fix`（stub）, `/resume`, `/sessions`, `/status`
- `session/brief.ts` — 自然言語発話からの SessionBrief 生成（Claude による分類）
- タスク種別に基づく水屋振り分けロジック（review/debug/explain → 通す、fix/会話 → 通さない）
- スラッシュコマンド時の分類スキップ
- セッションの自動保存・`rikyu --resume` CLI オプション
- テスト: slash commands（コマンドのみ、コマンド+プロンプト、未知コマンド、空入力、スラッシュなし）
- テスト: task routing（review→通す、debug→通す、explain→通す、fix→通さない、会話→通さない、スラッシュ→分類スキップ）

#### Step 11: Integration verification

- `rikyu review` の end-to-end 動作確認（モック CLI）
- `rikyu ask` の end-to-end 動作確認（モック CLI）
- 対話セッションの基本フロー確認（モック CLI）
- degraded mode の動作確認
- セッション保存 → resume の動作確認
- Quick ask/review が max 12s 以内で返ることの確認（performance budget）

### Phase 1: Unified CLI agent

**Goal**

Rikyu が読む・考える・動くの 3 ループを、ローカル CLI で一貫して提供できるようにする。

**Add**

- `debug`
- `fix --plan`
- `fix --patch`
- `fix --apply`
- mode 自動選択（Quick / Standard / Deep）
- 可変ターン deliberation（Claude の判断に委ねる）
- 変更規模推定と実行者選択（小→Claude、大→Codex）
- `--verbose` / `--json`
- privacy-safe redaction
- REPL continuation

**Must prove**

- review だけでなく ask/debug/fix-plan/fix-apply でも一つの声が維持される
- 異論提示がノイズではなく判断材料になる
- ユーザーが二つの CLI を別々に回すより短く前進できる

**Implementation steps**

#### Step 12: debug command

- `cli/debug.ts` — `rikyu debug "<symptom>"` コマンド
- debug 向け mizuya プロンプト（症状 → 仮説 → 確認手順を求める）
- debug 向け teishu プロンプト（水屋の仮説と自らの見解を突き合わせる）
- `/debug [prompt]` スラッシュコマンドの stub 解除
- テスト: debug の水屋振り分けが正しく動く

#### Step 13: fix command

- `cli/fix.ts` — `rikyu fix --plan` / `--patch` / `--apply` コマンド、`rikyu fix <path> --plan`
- `collaboration/change-size.ts` — 変更規模推定ロジック
- 変更規模に基づく実行者選択（小→Claude、大→Codex）
- `/fix [prompt]` スラッシュコマンドの stub 解除
- テスト: fix の各モード（plan, patch, apply）の基本動作、変更規模推定と実行者選択

#### Step 14: Mode auto-selection

- `session/mode.ts` — collaboration mode の自動選択ロジック（Quick / Standard / Deep）
- `--quick` / `--deep` CLI フラグによる上書き
- config の mode 設定との統合（CLI フラグ > config > 自動選択）
- テスト: mode 自動選択の各ケース

#### Step 15: Variable-turn deliberation

- Claude が「水屋に追加質問が必要」と判断した場合の追加ターンフロー
- mode に基づくターン上限の適用（Quick:1, Standard:2, Deep:3）
- 追加ターンの結果を Claude に再度渡すループ処理
- テスト: 追加ターンフローの基本動作

#### Step 16: Output options

- `output/json.ts` — `--json` 出力（degraded フラグ、findings、metadata、spans 含む）
- `--verbose` 出力（provider 情報、deliberation summary、スパンサマリー）
- `output/redaction.ts` — privacy-safe redaction（API キー、トークン等の自動マスク）
- テスト: JSON 出力、verbose 出力、redaction

#### Step 17: REPL continuation

- 対話セッション内で review → fix に連続して進む流れ
- 前のターンの結果（MizuyaResponse、findings）を次のターンで参照可能にする
- キャッシュの活用（review 結果を fix で再利用）
- テスト: 連続ターンでのキャッシュ再利用

### Phase 2: Guided change

**Goal**

承認付き変更適用の品質を上げ、再確認と失敗時対応を整える。

**Add**

- re-review after patch
- rollback guidance
- richer change verification

**Implementation steps**

#### Step 18: Re-review after patch

- fix --apply 後に自動で re-review を実行する仕組み
- re-review の結果を前回のレビュー結果と比較する
- 新たな問題が見つかった場合のユーザー通知

#### Step 19: Rollback guidance

- fix --apply が失敗した場合のロールバック手順の提示
- git stash / git checkout による復元ガイダンス
- 変更適用前の状態を記録する仕組み

#### Step 20: Richer change verification

- 変更適用後のテスト実行提案
- 変更が依存範囲に与える影響の分析
- 変更前後の diff サマリー

### Phase 3: Team surface

**Goal**

ローカルで成立した体験を、チーム運用に持ち込む。

**Add**

- SARIF 出力（MizuyaResponse からの直接変換）
- CI-friendly quiet mode
- GitHub Actions sample
- policy profiles

**Implementation steps**

#### Step 21: SARIF output

- MizuyaResponse → SARIF v2.1.0 変換ロジック
- `--sarif` CLI フラグ
- SARIF 出力のバリデーション（GitHub Code Scanning 互換性確認）

#### Step 22: CI-friendly mode

- `--ci` フラグ（非対話、進捗表示なし、exit code で結果を返す）
- quiet mode（finding がなければ何も出力しない）
- CI 環境の自動検知（`CI=true` 環境変数）

#### Step 23: GitHub Actions sample

- GitHub Actions workflow サンプルファイル
- PR コメントへの結果投稿スクリプト
- SARIF アップロードの設定例

#### Step 24: Policy profiles

- チーム向け設定プロファイル（厳格モード、寛容モード等）
- `.rikyu/policy.json` によるチーム共通ルール定義
- プロファイルの切り替え機構

## 13. Metrics

### Product metrics

| Metric | Why it matters |
|--------|----------------|
| Decision time | 判断までの時間が短くなったか |
| Forward progress rate | セッションが次アクションや修正に進んだか |
| Accepted finding rate | 指摘が採用されたか |
| Fix follow-through rate | plan や patch proposal が使われたか |
| Apply completion rate | 承認後の変更適用が最後まで完了したか |
| Noise rate | 不要な指摘が多すぎないか |
| Silent success rate | 0 件時の応答が適切か |
| Response time p50/p95 | 速度が敬意として成立しているか |

### Collaboration metrics

| Metric | Why it matters |
|--------|----------------|
| Mizuya utilization | 水屋の仕込みがどの程度最終出力に反映されたか |
| Duplicate suppression | 重複指摘を一つにまとめられたか |
| Disagreement usefulness | 異論が混乱ではなく判断材料になったか |
| Deliberation uplift | 単独出力より協働後が良いか |
| Deliberation cost | uplift に対して時間と token が見合うか |
| Additional turn rate | 追加ターンが発生した割合と、それが品質向上に繋がったか |

### Benchmark design

Rikyu の価値は、次の 3 条件の比較で検証する。

1. Codex only
2. Claude only
3. Rikyu（水屋 + 亭主）

各 task surface ごとに、品質と前進率の両方で比較する。

### Evaluation strategy

#### Eval dataset

`eval/` ディレクトリにタスク種別ごとの評価セットを用意する。

```text
eval/
  review/
    cases.json          # 入力（diff + context）のリスト
    rubric.md           # 評価基準（完全性、正確性、ノイズ率等）
  debug/
    cases.json
    rubric.md
  ask/
    cases.json
    rubric.md
```

各ケースは以下の形式:

```ts
interface EvalCase {
  id: string;
  input: {
    task: "review" | "debug" | "ask";
    content: string;      // diff, ファイル内容, 質問等
    context?: string;     // 追加コンテキスト
  };
  expected?: {
    mustMention: string[];     // 出力に含まれるべきキーワード
    mustNotMention: string[];  // 出力に含まれるべきでないもの
  };
}
```

#### LLM-as-judge

品質の定量評価には LLM-as-judge パターンを使う。同一入力に対する 3 条件（Codex only / Claude only / Rikyu）の出力を、別の LLM が rubric に基づいて採点する。

評価軸:
- **完全性**: 重要な指摘を見逃していないか
- **正確性**: 誤った指摘がないか
- **ノイズ率**: 不要な指摘が多すぎないか
- **行動可能性**: 次のアクションが明確か
- **統合品質**: 水屋と亭主の見解が矛盾なく統合されているか（Rikyu のみ）

#### Regression golden-file test

安定した出力（status 表示、ヘルプテキスト、エラーメッセージ等）は golden-file として保存し、変更後に diff で検証する。LLM 出力のような非決定的な出力には使わない。

#### Phase 別の評価目標

| Phase | 評価内容 |
|-------|---------|
| Phase 0 | eval セットで「水屋先行フローが Claude 単独より品質面で劣化しない」ことを確認 |
| Phase 1 | 3 条件比較で deliberation uplift を数値で示す |
| Phase 2+ | A/B テスト（設定変更の効果を定量比較） |

## 14. Test Strategy

### Approach

- フレームワーク: **Vitest**
- Phase 0 は**ユニットテストのみ**（外部 CLI は全てモック）
- 実装段階に合わせて、そのフェーズに必要なテストを都度追加する
- ファイルシステム依存のテストは tmpDir にパス注入で隔離
- CLI サブプロセスは `child_process` をモジュールレベルでモック

### Test inventory

実装フェーズに関わらず、最終的に必要なテストの全体像を以下に示す。

#### 1. Providers（CLI サブプロセス管理）

| テスト | 内容 |
|--------|------|
| 正常呼び出し | spawn → stdout → JSON パースが通る |
| CLI 未インストール | ENOENT エラーの処理 |
| 非ゼロ exit code | エラーハンドリング |
| タイムアウト | 一定時間で打ち切り |
| stdout 分割到着 | チャンクが分かれた場合のバッファリング |
| stderr 混在 | stderr にログが出つつ stdout に JSON が来るケース |
| シグナル終了 | SIGTERM/SIGKILL での終了 |

#### 2. MizuyaResponse（スキーマ・パース）

| テスト | 内容 |
|--------|------|
| 正常な JSON | Zod parse 成功 |
| 必須フィールド欠損 | parse 失敗 |
| 未知のフィールド | strip される |
| 空の findings | 有効（0件レビュー） |
| 不正な level 値 | "critical" 等の非許容値で失敗 |
| 不正な confidence 値 | 同上 |
| JSON 前にテキスト混入 | Codex が JSON 以外を先に出力したケース |
| 切り詰められた JSON | トークン上限で途中切断 |

#### 3. Config（設定管理）

| テスト | 内容 |
|--------|------|
| デフォルト値 | 設定ファイルなしでデフォルトが返る |
| グローバル設定読み込み | 正しくパースされる |
| プロジェクト設定読み込み | 正しくパースされる |
| マージ優先順位 | プロジェクトがグローバルを上書き |
| 部分的な設定 | 一部だけ指定した場合、残りはデフォルト |
| 不正な JSON | エラーハンドリング |
| 不正な値 | mode: "turbo" 等の非許容値 |
| config set/get | 値の書き込みと読み出し |

#### 4. Session（セッション管理）

| テスト | 内容 |
|--------|------|
| 保存 | スナップショットがファイルに書かれる |
| 復元 | 保存したスナップショットが正しく読める |
| ラウンドトリップ | 保存 → 復元で情報が欠落しない |
| 破損ファイル | JSON が壊れた場合のリカバリ |
| セッション一覧 | 複数セッションの列挙 |
| 存在しないセッション | resume 時のエラー |

#### 5. Cache（キャッシュ管理）

| テスト | 内容 |
|--------|------|
| キャッシュヒット | mtime 未変更で MizuyaResponse を再利用 |
| キャッシュミス | mtime 変更で再取得が必要と判定 |
| キャッシュ不在 | 初回アクセス |
| 対象ファイル削除 | ファイルが消えた場合 |

#### 6. Slash commands（スラッシュコマンド）

| テスト | 内容 |
|--------|------|
| コマンドのみ | `/review` → command: "review", prompt: undefined |
| コマンド + プロンプト | `/review このdiff見て` → command: "review", prompt: "このdiff見て" |
| 未知のコマンド | `/unknown` → エラーまたはヘルプ表示 |
| 空入力 | 何も入力しない場合 |
| スラッシュなし | 通常の自然言語として処理 |

#### 7. Task routing（タスク振り分け）

| テスト | 内容 |
|--------|------|
| review → 水屋に通す | ルーティングが正しい |
| debug → 水屋に通す | 同上 |
| explain → 水屋に通す | 同上 |
| fix → 水屋に通さない | 同上 |
| 会話 → 水屋に通さない | 同上 |
| スラッシュコマンド → 分類スキップ | SessionBrief 生成を呼ばない |

#### 8. Collaboration flow（水屋先行フロー）

| テスト | 内容 |
|--------|------|
| 正常フロー | Codex → Claude の順で呼ばれる |
| Codex 結果が Claude に渡る | MizuyaResponse が Claude のプロンプトに含まれる |
| degraded mode | Codex 失敗時に Claude 単独で続行 |
| degraded フラグ | JSON 出力に degraded: true が含まれる |
| stderr エラー記録 | degraded 時に stderr にログ |

#### 9. Status（環境チェック）

| テスト | 内容 |
|--------|------|
| 全正常 | 両 CLI 存在、認証 OK |
| Claude 不在 | エラー表示 |
| Codex 不在 | 警告表示（degraded で動ける） |
| 認証失敗 | エラー表示 |
| 設定不正 | 警告表示 |

#### 10. Output（出力）

| テスト | 内容 |
|--------|------|
| テキスト出力 | 正常に表示される |
| JSON 出力 | 有効な JSON として出力される |
| verbose 出力 | provider 情報が含まれる |
| degraded JSON | degraded フィールドが含まれる |

### Testing patterns

- **サブプロセスモック**: `child_process` を `vi.mock` でモジュールレベルでモック。テストごとに `mockImplementationOnce` で応答を変える
- **CLI 出力フィクスチャ**: `__fixtures__/` に実際の CLI 出力例を保存し、パーステストで使用
- **ファイルシステム隔離**: `fs.mkdtempSync` で tmpDir を作成し、config/session のパスを注入。`afterEach` でクリーンアップ
- **Zod バリデーション**: `safeParse` の `.success === true` と `.success === false` の両方をテスト
- **スナップショットテスト**: ヘルプテキストや status 出力等の安定したテキストにのみ使用。パース結果には明示的 assertion を使う

## 15. Acceptance Criteria

### Product

- `review` `ask` `debug` `fix --plan` `fix --apply` および対話セッションが同じ session contract で動く
- 最終出力は常に Rikyu の一つの声として整形される
- 承認なしにコード変更は適用しない（既存 CLI 承認機構を通す）
- 0 件時は短く完結し、無理に価値を捻り出さない
- 通常利用では Codex / Claude の名前を見せず、Rikyu だけを見せる

### Collaboration

- 水屋先行フローで Codex が MizuyaResponse を返せる
- Claude が水屋の仕込みと自らの見解を突き合わせて統合できる
- 異論がある場合、確認項目として返せる
- Codex CLI 障害時も degraded mode で有用な出力を返し、システムエラーを記録する

### Tea behavior

- 和敬清寂が出力の振る舞い制約として機能している
- 出力フォーマットは固定ではなく、Claude がタスクに応じて判断している
- 高コスト操作や patch 生成前に確認を取る（CLI 既存機構）
- デフォルト出力で vendor 名を主語にしない
- 0 件時のデフォルト出力は短く完結する
- 進捗表示は必要最低限に留まる

### Proof of value

- 少なくとも review と debug の評価セットで、Rikyu が Codex only と Claude only の両方より、decision time か forward progress rate のどちらかで上回る
- user study で「二つを別々に回すより楽」と判断される

## 15. Notes on Extensibility

拡張性は必要だが、最初の主語ではない。先に証明すべきなのは、**水屋と亭主の協働を茶道の精神で統べると、読み・判断・行動の連続体験が本当に良くなるか**である。

API 直接呼び出し、adapter の追加、MCP、チームメモリ、CI 面の一般化は、その証明の後に進める。

### Agent interoperability protocols

2025-2026年にエージェント間通信の標準化が進んでいる（MCP: ツール/コンテキスト標準化、A2A: Google のエージェント間交渉、ACP: RESTful エージェントメッセージング）。Rikyu は Phase 0 でこれらに準拠しない。理由:

- Rikyu の二者協働は CLI サブプロセスの stdin/stdout で完結しており、プロトコル層の抽象化は過剰
- MizuyaResponse は SARIF ベースの独自スキーマだが、MCP/A2A への変換レイヤーは後から追加できる
- Phase 3 で CI / チームサーフェスに拡張する際に、MCP ツールとしての公開や A2A 対応を検討する
