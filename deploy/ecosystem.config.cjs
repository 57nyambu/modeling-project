// PM2 process for the Django API (gunicorn on 127.0.0.1:4970).
//
//   pm2 start deploy/ecosystem.config.cjs     first time (then: pm2 save)
//   pm2 sendSignal SIGHUP supermarket-api     reload new code without downtime
//   pm2 logs supermarket-api                  see requests and errors
//
// Settings come from api/.env, which Django reads itself (see api/.env.example).

const path = require('path')

const api = path.join(__dirname, '..', 'api')

module.exports = {
  apps: [
    {
      name: 'supermarket-api',
      cwd: api,
      script: path.join(api, '.venv', 'bin', 'gunicorn'),
      args: '-c gunicorn.conf.py config.wsgi:application',
      interpreter: 'none',
      exec_mode: 'fork',
      instances: 1, // gunicorn runs its own worker processes
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      // SIGTERM lets gunicorn finish running requests (graceful_timeout is 30 s);
      // PM2's default SIGINT would stop it at once.
      kill_signal: 'SIGTERM',
      kill_timeout: 35000,
      env: {
        PYTHONUNBUFFERED: '1',
      },
    },
  ],
}
