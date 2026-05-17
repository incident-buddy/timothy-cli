# @timothy/api

HTMLファイルのアップロード・配信を行うAPIサーバー。Hono + Cloud Run で動作する。

## ローカル開発

Firebase エミュレータを起動してから開発サーバーを立ち上げる。

```bash
# Firebase エミュレータ起動（Firestore + Storage）
firebase emulators:start --only firestore,storage

# 別ターミナルで開発サーバー起動
pnpm dev

# テスト用APIキーをエミュレータに投入
pnpm seed:local
```

### 環境変数（ローカル）

エミュレータ使用時は `FIRESTORE_EMULATOR_HOST` が設定されていれば Firebase への認証情報は不要。

```env
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
FIREBASE_PROJECT_ID=demo-test
FIREBASE_STORAGE_BUCKET=demo-test.example.com
```

---

## Cloud Run デプロイ

### 前提条件

- Google Cloud SDK (`gcloud`) インストール済み
- Artifact Registry リポジトリ作成済み
- Secret Manager に各シークレット登録済み（後述）
- Cloud Run サービスアカウントに Secret Manager アクセス権限付与済み

### シークレット登録（初回のみ）

```bash
# サービスアカウントキー（JSON）から各値を取り出して登録
echo -n "your-project-id" | gcloud secrets create FIREBASE_PROJECT_ID --data-file=-
echo -n "your-client-email@project.iam.gserviceaccount.com" | gcloud secrets create FIREBASE_CLIENT_EMAIL --data-file=-
echo -n "your-bucket-name.appspot.com" | gcloud secrets create FIREBASE_STORAGE_BUCKET --data-file=-

# 秘密鍵は改行を含むため printf を使う
printf '%s' "$(cat serviceAccount.json | jq -r .private_key)" \
  | gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=-
```

### イメージビルド & プッシュ

```bash
PROJECT=your-gcp-project-id
REGION=asia-northeast1
IMAGE=${REGION}-docker.pkg.dev/${PROJECT}/timothy/api:latest

docker build -f packages/api/Dockerfile -t ${IMAGE} .
docker push ${IMAGE}
```

### デプロイ

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

---

## 環境変数リファレンス

| 変数名 | 説明 | 本番での管理方法 |
|---|---|---|
| `FIREBASE_PROJECT_ID` | GCP プロジェクト ID | Secret Manager |
| `FIREBASE_CLIENT_EMAIL` | サービスアカウントのメールアドレス | Secret Manager |
| `FIREBASE_PRIVATE_KEY` | サービスアカウントの秘密鍵（`\n` を含む） | Secret Manager |
| `FIREBASE_STORAGE_BUCKET` | Cloud Storage バケット名 | Secret Manager |
| `PORT` | サーバーのリッスンポート（デフォルト: 3000） | Cloud Run が 8080 を自動注入 |

---

## インフラ要件

| 項目 | 設定値 |
|---|---|
| 最小インスタンス数 | 0（コスト抑制） |
| 最大インスタンス数 | 2 |
| Cloud Storage | パブリックアクセス禁止、署名付きURL経由のみ配信 |
| Firestore | Admin SDK 経由のみ書き込み可 |

---

## ローカルで Docker イメージを確認する

```bash
# ビルド（リポジトリルートから実行）
docker build -f packages/api/Dockerfile -t timothy-api .

# 起動（.env にFirebase認証情報を記載）
docker run -p 8080:8080 --env-file .env timothy-api
```
