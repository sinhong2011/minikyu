#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Prepare Apple signing certificate for GitHub Actions.

Usage:
  scripts/prepare-apple-certificate.sh --input <file.p12> [options]

Options:
  -i, --input <path>           Input .p12 file (required)
  -o, --output <path>          Output modern .p12 path (default: <input>-modern.p12)
  -p, --password <value>       .p12 password (or use APPLE_CERTIFICATE_PASSWORD env)
      --password-env <name>    Env var name for password (default: APPLE_CERTIFICATE_PASSWORD)
      --no-convert             Skip conversion and only validate + export base64
      --copy                   Copy base64 output to clipboard (pbcopy)
  -h, --help                   Show this help

Examples:
  APPLE_CERTIFICATE_PASSWORD='***' scripts/prepare-apple-certificate.sh --input Certificates.p12 --copy
  scripts/prepare-apple-certificate.sh --input Certificates.p12 --password '***' --output Certificates-modern.p12
EOF
}

INPUT=""
OUTPUT=""
PASSWORD=""
PASSWORD_ENV="APPLE_CERTIFICATE_PASSWORD"
NO_CONVERT=false
COPY_TO_CLIPBOARD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--input)
      INPUT="${2:-}"
      shift 2
      ;;
    -o|--output)
      OUTPUT="${2:-}"
      shift 2
      ;;
    -p|--password)
      PASSWORD="${2:-}"
      shift 2
      ;;
    --password-env)
      PASSWORD_ENV="${2:-}"
      shift 2
      ;;
    --no-convert)
      NO_CONVERT=true
      shift
      ;;
    --copy)
      COPY_TO_CLIPBOARD=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$INPUT" ]]; then
  echo "Missing required option: --input" >&2
  usage
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Input file not found: $INPUT" >&2
  exit 1
fi

if [[ -z "$PASSWORD" ]]; then
  PASSWORD="${!PASSWORD_ENV:-}"
fi

if [[ -z "$PASSWORD" ]]; then
  echo "Missing certificate password. Use --password or set $PASSWORD_ENV." >&2
  exit 1
fi

if [[ -z "$OUTPUT" ]]; then
  INPUT_BASE="${INPUT%.p12}"
  OUTPUT="${INPUT_BASE}-modern.p12"
fi

validate_with_mode() {
  local mode="$1"
  if [[ "$mode" == "legacy" ]]; then
    openssl pkcs12 -legacy -in "$INPUT" -passin "pass:$PASSWORD" -nokeys -info >/dev/null 2>&1
  else
    openssl pkcs12 -in "$INPUT" -passin "pass:$PASSWORD" -nokeys -info >/dev/null 2>&1
  fi
}

READ_MODE="default"
if ! validate_with_mode "default"; then
  if validate_with_mode "legacy"; then
    READ_MODE="legacy"
  else
    echo "Failed to validate input certificate. Password may be wrong or file is invalid." >&2
    exit 1
  fi
fi

if [[ "$NO_CONVERT" == "true" ]]; then
  cp "$INPUT" "$OUTPUT"
else
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT

  PEM_FILE="$TMP_DIR/certificate.pem"
  if [[ "$READ_MODE" == "legacy" ]]; then
    openssl pkcs12 -legacy -in "$INPUT" -passin "pass:$PASSWORD" -nodes -out "$PEM_FILE" >/dev/null 2>&1
  else
    openssl pkcs12 -in "$INPUT" -passin "pass:$PASSWORD" -nodes -out "$PEM_FILE" >/dev/null 2>&1
  fi

  openssl pkcs12 -export \
    -in "$PEM_FILE" \
    -out "$OUTPUT" \
    -passout "pass:$PASSWORD" \
    -keypbe AES-256-CBC \
    -certpbe AES-256-CBC \
    -macalg sha256 >/dev/null 2>&1
fi

if ! openssl pkcs12 -in "$OUTPUT" -passin "pass:$PASSWORD" -nokeys -info >/dev/null 2>&1; then
  echo "Failed to validate output certificate: $OUTPUT" >&2
  exit 1
fi

BASE64_FILE="${OUTPUT%.p12}.base64.txt"
if base64 -i "$OUTPUT" >/dev/null 2>&1; then
  base64 -i "$OUTPUT" | tr -d '\n' > "$BASE64_FILE"
else
  base64 "$OUTPUT" | tr -d '\n' > "$BASE64_FILE"
fi

if [[ "$COPY_TO_CLIPBOARD" == "true" ]]; then
  if command -v pbcopy >/dev/null 2>&1; then
    pbcopy < "$BASE64_FILE"
  else
    echo "pbcopy not found; skipping clipboard copy." >&2
  fi
fi

echo "Prepared certificate: $OUTPUT"
echo "Base64 output: $BASE64_FILE"
echo "Use the file content as GitHub secret APPLE_CERTIFICATE."
