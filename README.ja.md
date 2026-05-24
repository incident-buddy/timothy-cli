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
- [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) のインストールと認証
- [`firebase` CLI](https://firebase.google.com/docs/cli) のインストールと認証（`firebase login`）
- Dockerのインストール

### 1. 必要なGCP APIの有効化

```bash
PROJECT=your-gcp-project-id
REGION=asia-northeast1

gcloud config set project ${PROJECT}

gcloud services enable \
  firestore.googleapis.com \
  storage.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com
```

### 2. FirestoreとStorageのセットアップ

Firestoreデータベースを作成します:

```bash
gcloud firestore databases create --location=${REGION}
```

リポジトリルートからFirestoreルール・インデックス・Storageルールをデプロイします:

```bash
firebase use ${PROJECT}
firebase deploy --only firestore,storage
```

これにより以下が適用されます:
- `firestore.rules` — クライアントからの直接アクセスを禁止
- `firestore.indexes.json` — `tim list` で使用する `htmlFiles` の複合インデックス（userId + createdAt）
- `storage.rules` — Cloud Storageへの直接パブリックアクセスを禁止

### 3. サービスアカウントの作成

```bash
gcloud iam service-accounts create timothy-api \
  --display-name "Timothy API"

SA=timothy-api@${PROJECT}.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding ${PROJECT} \
  --member "serviceAccount:${SA}" \
  --role "roles/datastore.user"

gcloud projects add-iam-policy-binding ${PROJECT} \
  --member "serviceAccount:${SA}" \
  --role "roles/storage.objectAdmin"

gcloud iam service-accounts keys create serviceAccount.json \
  --iam-account ${SA}
```

### 4. Artifact Registryリポジトリの作成

```bash
gcloud artifacts repositories create timothy \
  --repository-format docker \
  --location ${REGION}
```

### 5. Secret Managerへのシークレット登録

```bash
echo -n "${PROJECT}" | gcloud secrets create FIREBASE_PROJECT_ID --data-file=-
echo -n "timothy-api@${PROJECT}.iam.gserviceaccount.com" | gcloud secrets create FIREBASE_CLIENT_EMAIL --data-file=-
echo -n "${PROJECT}.appspot.com" | gcloud secrets create FIREBASE_STORAGE_BUCKET --data-file=-
printf '%s' "$(cat serviceAccount.json | jq -r .private_key)" \
  | gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=-
```

Cloud Runのデフォルトサービスアカウントにシークレットへのアクセス権を付与します:

```bash
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT} --format='value(projectNumber)')
CLOUD_RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_STORAGE_BUCKET FIREBASE_PRIVATE_KEY; do
  gcloud secrets add-iam-policy-binding ${SECRET} \
    --member "serviceAccount:${CLOUD_RUN_SA}" \
    --role "roles/secretmanager.secretAccessor"
done
```

### 6. APIのビルドとデプロイ

リポジトリルートからDockerイメージをビルド・プッシュします:

```bash
IMAGE=${REGION}-docker.pkg.dev/${PROJECT}/timothy/api:latest

docker build -f packages/api/Dockerfile -t ${IMAGE} .
docker push ${IMAGE}
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
  --allow-unauthenticated
```

注: `--allow-unauthenticated` は共有URL（`/s/<id>`）をリンクを知っている人が誰でも開けるようにするために必要です。アップロード・一覧・削除エンドポイントはアプリケーションレベルのAPIキーで保護されています。

デプロイ後に表示されるサービスURLをメモしてください（ステップ8で使用します）。

### 7. APIキーの発行

seedスクリプトを使ってFirestoreの `apiKeys` コレクションにエントリを追加します:

```bash
FIREBASE_PROJECT_ID=${PROJECT} \
FIREBASE_CLIENT_EMAIL=$(cat serviceAccount.json | jq -r .client_email) \
FIREBASE_PRIVATE_KEY=$(cat serviceAccount.json | jq -r .private_key) \
API_KEY=hs_$(openssl rand -hex 16) \
USER_ID=user@example.com \
npx tsx packages/api/scripts/seed-api-key.ts
```

表示されたAPIキーをメモし、Cloud RunサービスのURLとともにユーザーに共有してください。

または、Firebaseコンソールから Firestore > `apiKeys` コレクションに手動で追加することもできます:

```json
{
  "key": "hs_xxxxxxxxxxxxxxxxxxxx",
  "userId": "user@example.com",
  "createdAt": "<Timestamp>"
}
```

### 8. （オプション）IPアドレス制限の設定

共有ファイルの閲覧者をIPアドレスで制限する場合、Cloud Runの `ALLOWED_IPS` 環境変数にカンマ区切りでIPまたはCIDRを設定します:

```bash
gcloud run services update timothy-api \
  --region ${REGION} \
  --set-env-vars ALLOWED_IPS="203.0.113.0/24,198.51.100.42"
```

`ALLOWED_IPS` を設定しない場合、共有URLは任意のIPからアクセス可能です。

### 9. CLIの設定

ユーザーはAPIキーとCloud RunサービスのURLを使ってCLIを設定します:

```bash
tim setup
# API key: hs_xxxxxxxxxxxxxxxxxxxx
# API endpoint [https://api.timothy.example.com]: https://timothy-api-xxxx-an.a.run.app
```

### インフラ構成

| コンポーネント | 設定 |
|---|---|
| Cloud Run | 最小インスタンス: 0、最大インスタンス: 2、認証なし（allow-unauthenticated） |
| Cloud Storage | パブリックアクセス禁止・Cloud Run APIを経由してプロキシ配信 |
| Firestore | Admin SDK経由のみ書き込み可・Firebase CLIでルール・インデックスを管理 |
| 認証 | アップロード・一覧・削除はAPIキー（Bearerトークン）、共有URLはオプションのIPアドレス制限 |

## ライセンス

EPL-2.0
