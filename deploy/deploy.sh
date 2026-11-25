#!/usr/bin/env bash
# Deploy or update the Supermarket Checkout Simulation on the server.
#
#   cd /home/modeling-project && bash deploy/deploy.sh
#
# Pulls main, installs the Python and Node dependencies, migrates the SQLite
# database, builds the web app into web/dist (served by nginx) and starts or
# reloads the API under PM2. Saved runs in api/db.sqlite3 are never touched.
set -euo pipefail

cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"
PM2_NAME="supermarket-api"
API_URL="http://127.0.0.1:4970/api/meta"

step() { printf '\n==> %s\n' "$1"; }
fail() { printf '\nDeploy stopped: %s\n' "$1" >&2; exit 1; }

step "Checking the server"
command -v python3 >/dev/null || fail "python3 is not installed"
python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" \
  || fail "Python 3.10 or newer is needed (found $(python3 --version))"
command -v node >/dev/null || fail "Node.js is not installed (version 20.19+ or 22.12+ is needed)"
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22||(a===22&&b>=12)||(a===20&&b>=19)?0:1)" \
  || fail "Node.js 20.19+ or 22.12+ is needed to build the web app (found $(node --version))"
command -v pm2 >/dev/null || fail "PM2 is not installed: sudo npm install -g pm2"
[ -f api/.env ] || fail "api/.env is missing: cp api/.env.example api/.env, then fill in DJANGO_SECRET_KEY"
grep -Eq '^DJANGO_SECRET_KEY=.+' api/.env || fail "DJANGO_SECRET_KEY is empty in api/.env"

step "Updating the code"
git fetch --quiet origin main
git merge --ff-only origin/main

step "Installing Python packages"
[ -x api/.venv/bin/python ] || python3 -m venv api/.venv \
  || fail "could not create the virtual environment (sudo apt install -y python3-venv)"
api/.venv/bin/pip install --quiet --upgrade pip
api/.venv/bin/pip install --quiet -r api/requirements-prod.txt

step "Checking Django and migrating the database"
(cd api && .venv/bin/python manage.py check && .venv/bin/python manage.py migrate --noinput)

step "Running the engine tests"
(cd api && .venv/bin/python -m unittest discover -s simulation/tests -t . -q)

step "Building the web app"
(cd web && npm ci --include=dev --no-audit --no-fund && npm run build)

step "Starting the API"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  # gunicorn starts new workers with the new code, then retires the old ones.
  pm2 sendSignal SIGHUP "$PM2_NAME" >/dev/null
  sleep 3
else
  pm2 start deploy/ecosystem.config.cjs
  pm2 save
fi

step "Checking the API"
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "$API_URL"; then
    printf '\nDeployed %s from %s\n' "$(git rev-parse --short HEAD)" "$APP_DIR"
    exit 0
  fi
  sleep 1
done
fail "the API did not answer on $API_URL. See: pm2 logs $PM2_NAME --lines 50"
