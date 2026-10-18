# Running on your own VPS

The files in `deploy/vps/` run the whole stack on one Linux server with HTTPS, and back it up
to OneDrive every night. The general self-hosting guide is [self-hosting.md](self-hosting.md).

## What you need

- A VPS with Ubuntu or Debian, 2 vCPU and 4 GB RAM or more, and SSH access as root.
- Two domain names pointing (A record) at the server, for example `plan.example.com` for the
  web app and `api.example.com` for the api.

## Install

```bash
git clone https://github.com/haniakrim/itsaplan.git /opt/itsaplan
cd /opt/itsaplan
bash deploy/vps/setup.sh      # first run: creates .env with generated secrets
nano .env                     # set APP_DOMAIN, API_DOMAIN, ACME_EMAIL, APP_URL, API_URL
bash deploy/vps/setup.sh      # second run: firewall, build and start
```

`setup.sh` installs Docker and rclone when they are missing, opens only SSH, 80 and 443, and
starts the stack with `deploy/vps/docker-compose.vps.yml` on top of `docker-compose.yml`:

- Caddy answers on 80 and 443 and gets certificates from Let's Encrypt for both domains.
- The api and web ports are bound to `127.0.0.1`, so only Caddy reaches them.
- RustFS (the file store) and Postgres publish no port at all.

The stack is built from this checkout (`--build`). To update:

```bash
cd /opt/itsaplan && git pull
docker compose -f docker-compose.yml -f deploy/vps/docker-compose.vps.yml up -d --build
```

Every start runs the migrations, and each migration backs up the database first (see
[self-hosting.md](self-hosting.md#updating)).

## Back up to OneDrive

1. Create the rclone remote. The server has no browser, so authorize on your own computer:
   ```bash
   rclone authorize "onedrive"      # on your computer: sign in with the company account
   rclone config                    # on the server: new remote "onedrive", type onedrive,
                                    # paste the token, choose "OneDrive for Business"
   ```
   Use a dedicated company account for this, not a personal one.
2. Try it once: `bash deploy/vps/backup-to-onedrive.sh`
3. Run it every night at 02:00:
   ```bash
   crontab -e
   0 2 * * * /opt/itsaplan/deploy/vps/backup-to-onedrive.sh >> /var/log/itsaplan-backup.log 2>&1
   ```

The script writes a database dump to `itsaplan-backup/db` (the last 14 days are kept) and
mirrors the stored files to `itsaplan-backup/files`. Set `BACKUP_REMOTE` to use another remote
or folder.

To restore, copy a dump back and load it with
`docker compose exec -T postgres pg_restore -U itsaplan -d itsaplan --clean < db-….dump`, and
copy the files back into the RustFS volume.
