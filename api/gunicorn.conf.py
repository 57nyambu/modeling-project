"""Gunicorn settings for the production API.

Started by PM2 (deploy/ecosystem.config.cjs) from the api folder:
    .venv/bin/gunicorn -c gunicorn.conf.py config.wsgi:application

Send SIGHUP to reload the workers with new code without dropping requests:
    pm2 sendSignal SIGHUP supermarket-api
"""

import os

# Only nginx on the same machine talks to gunicorn; never bind to 0.0.0.0.
bind = os.environ.get("GUNICORN_BIND", "127.0.0.1:4970")
workers = int(os.environ.get("GUNICORN_WORKERS", "3"))

# Large comparisons and the validation run inside the request (about 10 s on a
# laptop, longer on a busy server). nginx waits the same 180 s (proxy_read_timeout).
timeout = 180
graceful_timeout = 30

# Restart each worker now and then so memory used by NumPy, Pandas and
# Matplotlib is returned to the system.
max_requests = 500
max_requests_jitter = 50

# Logs go to stdout/stderr, which PM2 collects: pm2 logs supermarket-api
accesslog = "-"
errorlog = "-"
loglevel = "info"
