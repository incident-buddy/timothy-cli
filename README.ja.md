# Timothy

LLMが生成したHTMLをターミナルからアップロードし、有効期限付きURLで共有するセルフホスト型CLIツールです。URLを知っている人だけが閲覧でき、閲覧者のログインは不要です。

[English README](./README.md)

## 特徴

- HTMLをファイルまたは標準入力からアップロード
- 有効期限付きURLで共有（デフォルト: 7日間）
- アップロード済みファイルの一覧表示・削除をCLIで操作
- セルフホスト: ストレージとアクセスを自分で管理

## 仕組み

```
tim upload report.html  →  https://your-api/s/<id>
```

URLはCloud Run上のAPIを経由して配信されます。APIがプライベートなCloud StorageからHTMLを取得してプロキシするため、ファイルに直接アクセスすることはできません。アクセスは指定したTTL経過後に無効になります。

## 必要なもの

- デプロイ済みの `@timothy/api`（[セルフホスティング](#セルフホスティング) を参照）
- サーバー管理者から発行されたAPIキー

## インストール

```bash
npm install -g timothy-cli
```

インストールせずに実行する場合:

```bash
npx timothy-cli <command>
```

## 使い方

### セットアップ

APIキーとエンドポイントを保存します:

```bash
tim setup
# API key: hs_xxxxxxxxxxxx
# API endpoint [https://api.timothy.example.com]: https://your-api.example.com
```

設定は `~/.config/timothy/config.json` に保存されます。

### アップロード

```bash
# ファイルをアップロード
tim upload report.html

# タイトルと有効期限を指定
tim upload report.html --title "月次レポート" --ttl 30

# 標準入力から渡す
llm generate report | tim upload --stdin --title "生成レポート"
```

### 一覧表示

```bash
tim list
```

```
ID                          TITLE             CREATED       EXPIRES
01JWXYZ...                  月次レポート        2026-05-20    2026-05-27
01JWABC...                  分析結果            2026-05-18    2026-05-25
```

### 削除

```bash
tim delete <id>
# Delete 01JWXYZ...? [y/N] y
# Deleted 01JWXYZ...

# 確認プロンプトをスキップ
tim delete <id> --force
```

## セルフホスティング

Timothyのバックエンド（`@timothy/api`）は、FirestoreとCloud StorageをバックエンドにCloud Run上で動作します。

### 前提条件

- 課金が有効なGoogle Cloudプロジェクト
- `gcloud` CLIのインストールと認証
- Dockerのインストール
- Artifact Registryリポジトリの作成

### 1. APIのデプロイ

リポジトリルートからDockerイメージをビルド・プッシュします:

```bash
PROJECT=your-gcp-project-id
REGION=asia-northeast1
IMAGE=${REGION}-docker.pkg.dev/${PROJECT}/timothy/api:latest

docker build -f packages/api/Dockerfile -t ${IMAGE} .
docker push ${IMAGE}
```

Secret Managerにシークレットを登録します:

```bash
echo -n "your-project-id" | gcloud secrets create FIREBASE_PROJECT_ID --data-file=-
echo -n "your-client-email@project.iam.gserviceaccount.com" | gcloud secrets create FIREBASE_CLIENT_EMAIL --data-file=-
echo -n "your-bucket-name.appspot.com" | gcloud secrets create FIREBASE_STORAGE_BUCKET --data-file=-
printf '%s' "$(cat serviceAccount.json | jq -r .private_key)" \
  | gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=-
```

Cloud Runにデプロイします:

```bash
gcloud run deploy timothy-api \
  --image ${IMAGE} \
  --region ${REGION} \
  --min-instances 0 \
  --max-instances 2 \
  --set-secrets FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest \
  --set-secrets FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest \
  --set-secrets FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest \
  --set-secrets FIREBASE_STORAGE_BUCKET=FIREBASE_STORAGE_BUCKET:latest \
  --no-allow-unauthenticated
```

### 2. APIキーの発行

FirebaseコンソールまたはAdmin SDKで、Firestoreの `apiKeys` コレクションに手動でエントリを追加します:

```json
{
  "key": "hs_xxxxxxxxxxxxxxxxxxxx",
  "userId": "user@example.com",
  "createdAt": "<Timestamp>"
}
```

キーとCloud RunサービスのURLをユーザーに共有し、`tim setup` を実行してもらいます。

### インフラ構成

| コンポーネント | 設定 |
|---|---|
| Cloud Run | 最小インスタンス: 0、最大インスタンス: 2 |
| Cloud Storage | パブリックアクセス禁止・Cloud Run APIを経由してプロキシ配信 |
| Firestore | Admin SDK経由のみ書き込み可 |
| 認証 | APIキー（Bearerトークン）、Firestoreで検証 |

## ライセンス

EPL-2.0
