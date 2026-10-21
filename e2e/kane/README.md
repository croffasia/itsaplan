# End-to-end (e2e) tests for web

Browser tests written in plain English for [Kane CLI](https://www.testmuai.com/kane-cli/).

| Test | What it covers |
|---|---|
| `setup_test.md` | First run: the administrator account, a team and a project board |
| `issue_test.md` | Creating an issue with a status and priority, then moving it to In Progress |

## Run

Each test starts from an empty instance. Create `.env` with the secrets `docker-compose.yml` lists as required, plus these values for the web app on port 4931 and the api on 4930:

```bash
API_URL=http://localhost:4930
APP_URL=http://localhost:4931
API_PORT=4930
WEB_PORT=4931
```

```bash
docker compose up -d --wait postgres minio minio-init migrate api web worker
npm install -g @testmuai/kane-cli
kane-cli login
kane-cli testmd run e2e/kane/setup_test.md
```

Reset with `docker compose down -v` and start again before each run.
