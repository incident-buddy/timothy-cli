# Timothy

A self-hosted CLI tool to upload LLM-generated HTML and share it via time-limited URLs. Only people who know the URL can view the file — no login required for viewers.

[日本語版はこちら](./README.ja.md)

## Features

- Upload HTML from a file or stdin
- Share via a time-limited URL (default: 7 days)
- List and delete your uploaded files from the CLI
- Self-hosted: you control the storage and access

## How It Works

```
tim upload report.html  →  https://your-api/s/<id>
```

The URL is served through your Cloud Run API, which fetches the file from private Cloud Storage and proxies it. Files are never publicly accessible directly; access expires after the specified TTL.

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
# API endpoint [https://api.timothy.example.com]: https://your-api.example.com
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
- [`gcloud` CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated
- [`firebase` CLI](https://firebase.google.com/docs/cli) installed and authenticated (`firebase login`)
- Docker installed

### 1. Enable required GCP APIs

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

### 2. Set up Firestore and Storage

Create the Firestore database:

```bash
gcloud firestore databases create --location=${REGION}
```

Deploy Firestore rules, indexes, and Storage rules from the repository root:

```bash
firebase use ${PROJECT}
firebase deploy --only firestore,storage
```

This applies:
- `firestore.rules` — blocks all direct client access
- `firestore.indexes.json` — composite index on `htmlFiles` (userId + createdAt) used by `tim list`
- `storage.rules` — blocks all direct public access to Cloud Storage

### 3. Create a service account

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

### 4. Create an Artifact Registry repository

```bash
gcloud artifacts repositories create timothy \
  --repository-format docker \
  --location ${REGION}
```

### 5. Register secrets in Secret Manager

```bash
echo -n "${PROJECT}" | gcloud secrets create FIREBASE_PROJECT_ID --data-file=-
echo -n "timothy-api@${PROJECT}.iam.gserviceaccount.com" | gcloud secrets create FIREBASE_CLIENT_EMAIL --data-file=-
echo -n "${PROJECT}.appspot.com" | gcloud secrets create FIREBASE_STORAGE_BUCKET --data-file=-
printf '%s' "$(cat serviceAccount.json | jq -r .private_key)" \
  | gcloud secrets create FIREBASE_PRIVATE_KEY --data-file=-
```

Grant the Cloud Run default service account access to these secrets:

```bash
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT} --format='value(projectNumber)')
CLOUD_RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for SECRET in FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_STORAGE_BUCKET FIREBASE_PRIVATE_KEY; do
  gcloud secrets add-iam-policy-binding ${SECRET} \
    --member "serviceAccount:${CLOUD_RUN_SA}" \
    --role "roles/secretmanager.secretAccessor"
done
```

### 6. Build and deploy the API

Build and push the Docker image from the repository root:

```bash
IMAGE=${REGION}-docker.pkg.dev/${PROJECT}/timothy/api:latest

docker build -f packages/api/Dockerfile -t ${IMAGE} .
docker push ${IMAGE}
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
  --allow-unauthenticated
```

Note: `--allow-unauthenticated` is required so that share URLs (`/s/<id>`) are accessible to anyone who knows the link. Upload and list/delete endpoints are protected by the API key at the application level.

After deploying, note the service URL printed by the command — you'll need it in step 8.

### 7. Issue an API key

Add an entry to Firestore's `apiKeys` collection using the seed script:

```bash
FIREBASE_PROJECT_ID=${PROJECT} \
FIREBASE_CLIENT_EMAIL=$(cat serviceAccount.json | jq -r .client_email) \
FIREBASE_PRIVATE_KEY=$(cat serviceAccount.json | jq -r .private_key) \
API_KEY=hs_$(openssl rand -hex 16) \
USER_ID=user@example.com \
npx tsx packages/api/scripts/seed-api-key.ts
```

Note the printed API key — share it along with the Cloud Run service URL with each user.

Alternatively, add the entry manually via the Firebase console under Firestore > `apiKeys` collection:

```json
{
  "key": "hs_xxxxxxxxxxxxxxxxxxxx",
  "userId": "user@example.com",
  "createdAt": "<Timestamp>"
}
```

### 8. (Optional) Restrict access by IP

To limit who can view shared files, set the `ALLOWED_IPS` environment variable on Cloud Run (comma-separated IPs or CIDR ranges):

```bash
gcloud run services update timothy-api \
  --region ${REGION} \
  --set-env-vars ALLOWED_IPS="203.0.113.0/24,198.51.100.42"
```

If `ALLOWED_IPS` is not set, share URLs are accessible from any IP.

### 9. Configure the CLI

Users can now configure the CLI with their API key and the Cloud Run service URL:

```bash
tim setup
# API key: hs_xxxxxxxxxxxxxxxxxxxx
# API endpoint [https://api.timothy.example.com]: https://timothy-api-xxxx-an.a.run.app
```

### Infrastructure Overview

| Component | Config |
|---|---|
| Cloud Run | min-instances: 0, max-instances: 2, allow-unauthenticated |
| Cloud Storage | Public access disabled; proxied through Cloud Run API |
| Firestore | Write access via Admin SDK only; rules and indexes managed via Firebase CLI |
| Auth | API key (Bearer token) for upload/list/delete; optional IP allowlist for share URLs |

## License

EPL-2.0
