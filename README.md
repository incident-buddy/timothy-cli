# Timothy

A self-hosted CLI tool to upload LLM-generated HTML and share it via signed URLs. Only people who know the URL can view the file — no login required for viewers.

[日本語版はこちら](./README.ja.md)

## Features

- Upload HTML from a file or stdin
- Share via a time-limited signed URL (default: 7 days)
- List and delete your uploaded files from the CLI
- Self-hosted: you control the storage and access

## How It Works

```
tim upload report.html  →  https://your-api/s/<id>
```

The URL is served through your Cloud Run API with IP allowlist protection. Storage is private — files are never publicly accessible directly.

## Requirements

- A deployed instance of `@timothy/api` (see [Self-Hosting](#self-hosting))
- An API key issued by the server admin

## Installation

```bash
npm install -g timothy-cli
```

Or run without installing:

```bash
npx timothy-cli <command>
```

## Usage

### Setup

Save your API key and endpoint:

```bash
tim setup
# API key: hs_xxxxxxxxxxxx
# API endpoint: https://your-api.example.com
```

Configuration is stored in `~/.config/timothy/config.json`.

### Upload

```bash
# Upload a file
tim upload report.html

# Upload with a custom title and TTL
tim upload report.html --title "Monthly Report" --ttl 30

# Pipe from stdin
llm generate report | tim upload --stdin --title "Generated Report"
```

### List

```bash
tim list
```

```
ID                          TITLE             CREATED       EXPIRES
01JWXYZ...                  Monthly Report    2026-05-20    2026-05-27
01JWABC...                  Analysis          2026-05-18    2026-05-25
```

### Delete

```bash
tim delete <id>
# Delete 01JWXYZ...? [y/N] y
# Deleted 01JWXYZ...

# Skip confirmation
tim delete <id> --force
```

## Self-Hosting

Timothy's backend (`@timothy/api`) runs on Cloud Run with Firestore and Cloud Storage.

### Prerequisites

- Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated
- Docker installed
- Artifact Registry repository created

### 1. Deploy the API

Build and push the Docker image from the repository root:

```bash
PROJECT=your-gcp-project-id
REGION=asia-northeast1
IMAGE=${REGION}-docker.pkg.dev/${PROJECT}/timothy/api:latest

docker build -f packages/api/Dockerfile -t ${IMAGE} .
docker push ${IMAGE}
```

Register secrets in Secret Manager:

```bash
echo -n "your-project-id" | gcloud secrets create FIREBASE_PROJECT_ID --data-file=-
echo -n "your-client-email@project.iam.gserviceaccount.com" | gcloud secrets create FIREBASE_CLIENT_EMAIL --data-file=-
echo -n "your-bucket-name.appspot.com" | gcloud secrets create FIREBASE_STORAGE_BUCKET --data-file=-
printf '%s' "$(cat serviceAccount.json | jq -r .private_key)" \
  | gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=-
```

Deploy to Cloud Run:

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

### 2. Issue an API Key

Add an entry to Firestore's `apiKeys` collection manually (via the Firebase console or Admin SDK):

```json
{
  "key": "hs_xxxxxxxxxxxxxxxxxxxx",
  "userId": "user@example.com",
  "createdAt": "<Timestamp>"
}
```

Share the key and your Cloud Run service URL with users, then they can run `tim setup`.

### Infrastructure Overview

| Component | Config |
|---|---|
| Cloud Run | min-instances: 0, max-instances: 2 |
| Cloud Storage | Public access disabled; served via signed URL only |
| Firestore | Write access via Admin SDK only |
| Auth | API key (Bearer token), validated against Firestore |

## License

EPL-2.0
