# Deploying to supermarket.virontech.me

| Part | How it runs |
|---|---|
| Web app | nginx serves the built React app from `web/dist` |
| API | Django under gunicorn (3 workers, 180 s timeout), run by PM2 as `supermarket-api`, listening on `127.0.0.1:4970` only |
| Routing | nginx passes `/api/` to gunicorn and adds rate limits, gzip, caching and security headers |
| Database | SQLite at `api/db.sqlite3`. Git ignores it, so updates never touch saved runs. Never run `git clean` in the app folder. |
| Settings | `api/.env`, read by Django at start-up (template: `api/.env.example`) |

Files: `deploy/nginx/supermarket.virontech.me.conf`, `deploy/ecosystem.config.cjs` (PM2),
`api/gunicorn.conf.py`, `api/requirements-prod.txt` and `deploy/deploy.sh`.

## 1. One-time setup on the server

```bash
sudo apt install -y python3-venv nginx certbot python3-certbot-nginx
node --version                     # 20.19+ or 22.12+, needed to build the web app
command -v pm2 || sudo npm install -g pm2
ss -tlnp | grep 4970               # must print nothing: the port is free

sudo mkdir -p /home/modeling-project && sudo chown $USER:$USER /home/modeling-project
git clone https://github.com/57nyambu/modeling-project.git /home/modeling-project
cd /home/modeling-project

cp api/.env.example api/.env && chmod 600 api/.env
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
nano api/.env                      # paste the key after DJANGO_SECRET_KEY=
```

The repository is private, so the clone needs a GitHub deploy key or a personal
access token. Use the `token_urlsafe` key above, not Django's key generator: it
contains only letters, digits, `-` and `_`, so it is safe if a pipeline later
loads the file into a shell.

## 2. Deploy (first time and every update)

```bash
cd /home/modeling-project && bash deploy/deploy.sh
```

The script checks Python, Node, PM2 and `api/.env`; fast-forwards to `origin/main`;
installs the Python packages into `api/.venv`; runs `manage.py check`, the
migrations and the engine tests; builds `web/dist`; then starts the API with PM2
(first time, followed by `pm2 save`) or reloads it with `SIGHUP`, which swaps in
new workers without dropping requests. It finishes by calling `/api/meta`.

If PM2 is not yet set to start on boot on this server: `pm2 startup` (run the
command it prints), then `pm2 save`.

## 3. nginx and HTTPS (once, after the first deploy works)

1. Point the DNS A record for `supermarket.virontech.me` at the server.
2. Install the site and reload nginx:

   ```bash
   sudo cp deploy/nginx/supermarket.virontech.me.conf /etc/nginx/sites-available/
   sudo ln -s /etc/nginx/sites-available/supermarket.virontech.me.conf /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

3. Get the certificate (certbot adds HTTPS and the redirect from HTTP):

   ```bash
   sudo certbot --nginx -d supermarket.virontech.me
   ```

4. Check the firewall lets web traffic in: `sudo ufw allow 'Nginx Full'`. Port 4970
   stays private because gunicorn only listens on 127.0.0.1.

After a later change to the nginx file, repeat the `cp` and the `nginx -t && reload`
(certbot's HTTPS lines live in the copy under `/etc/nginx`, so re-run
`sudo certbot --nginx -d supermarket.virontech.me` after copying it again).

## 4. Check that it works

Before DNS is ready, send the domain as the Host header to the server itself:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: supermarket.virontech.me" http://127.0.0.1/          # 200
curl -s -H "Host: supermarket.virontech.me" http://127.0.0.1/api/meta | head -c 60; echo              # JSON
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: supermarket.virontech.me" \
     -H "Content-Type: application/json" -d '{}' http://127.0.0.1/api/runs                              # 201
ss -tlnp | grep 4970                                                                                   # 127.0.0.1:4970 only
```

After certbot, open https://supermarket.virontech.me and press Start simulation.

## Limits and protection

| Requests | Limit per IP address |
|---|---|
| Simulations: every POST, and the validation | 12 a minute, bursts of 10 |
| Downloads: CSV files and PNG charts | 30 a minute, bursts of 20 |
| Everything under `/api/` | 120 a minute, bursts of 60 |

Over a limit, nginx answers 429 with a JSON message that the app shows, for
example "Too many requests from your network: wait a minute and try again."
Everyone behind one network address (campus Wi-Fi, for example) shares a limit,
so raise `rate=` in the nginx file before demonstrating to a whole class.

- **Cloudflare:** if the DNS record is proxied (orange cloud), enable the real-IP
  lines in the nginx file, or all visitors share one limit.
- **Deleting results:** anyone can delete saved runs and comparisons. To require a
  password, uncomment the `limit_except` block in the nginx file and create the
  password file it names.
- **Admin:** the Django admin is not exposed; `/admin` shows the web app.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `400 Bad Request` from `/api/` | The domain is missing from `DJANGO_ALLOWED_HOSTS` in `api/.env`. Fix it, then `pm2 sendSignal SIGHUP supermarket-api`. |
| "The simulation server is not running" (503) | gunicorn is down: `pm2 status`, then `pm2 logs supermarket-api --lines 50`. |
| PM2 log shows `ImproperlyConfigured: DJANGO_DEBUG=0 needs a real DJANGO_SECRET_KEY` | `DJANGO_SECRET_KEY` is empty in `api/.env`. |
| Site gives 403 or 404 | nginx cannot read `web/dist`: run `deploy.sh` to build it, and `chmod 755 /home/modeling-project` if needed. |
| "The simulation took longer than 3 minutes" (504) | A very large comparison; use fewer replications or a shorter run. |
| `nginx -t`: `socket() [::]:80 failed (97: Address family not supported)` | The server has no IPv6: delete the `listen [::]:80;` line. |
| `deploy.sh` stops at "Updating the code" | The server copy has local changes or a rewritten history: `git status`, then `git fetch && git reset --hard origin/main`. |

Tested on Ubuntu 24.04 with nginx 1.24, PM2 7 and gunicorn 23: page, assets,
API, simulation runs, downloads, rate limits, JSON error pages and a reload
during traffic.
