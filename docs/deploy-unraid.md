# Docker and Unraid

The Finapp-style workflow builds a complete versioned image locally, tests it, tags latest, then publishes deliberately. SQLite and files stay on the mounted Unraid volume.

## Optional release shortcut

The existing build, test, tag and push workflow below remains available. If it already works for your Windows checkout and Unraid deployment, keep using it with your existing Docker authentication and deployment settings.

The additive shortcut combines the existing build/tag/push commands:

```sh
npm run docker:release
```

It builds `afbeals/tide:<package.json version>` for `linux/amd64`, tags the same image as `afbeals/tide:latest`, then pushes both tags. It does not run tests, change your version, log in or update Unraid. It stops on the first failed or interrupted Docker command. If the version push succeeds but the latest push fails, resolve the error and retry `npm run docker:push`.

Use your existing versioning process. Only choose a fresh package version when needed; do not bump again if the intended release version is already committed. An optional npm command is `npm version patch --no-git-tag-version`; commit the package/lockfile changes if you use it.

Only if Docker Hub authentication is missing or expired, authenticate with your usual account using `docker login`. Existing working credentials need no login step.

## Existing release workflow

After merging the changes on GitHub, run these commands from the Windows checkout:

```powershell
git switch main
git pull --ff-only
npm run docker:build
npm run docker:test
# verify running
docker stop tide-local
# then publish:
npm run docker:tag
npm run docker:push
```

`docker:push` requires Docker Hub authentication and publishes both the versioned image and `afbeals/tide:latest`. On Unraid, select **Docker → Check for Updates → Update** for Tide after publishing. Scheduled update checks and notifications depend on the Unraid configuration. Keep the existing data-folder mapping when recreating the container.

The local image test uses `./docker-data` and http://localhost:8776. After testing, `npm run docker:push` publishes the image you tested; `docker:release` starts a new build. Keep using your established backup process before an update, and retain your actual host ports, data mounts and environment settings. The paths and ports in this guide are repository examples, not a verification of your live Unraid host.

The build targets `linux/amd64` using Node 24 Debian slim. Native better-sqlite3 may compile from source. Build and publish without Google keys. Both keys are configured only in the running Unraid container. Local development disables Google; `docker:test` also explicitly disables live mode and clears Google keys, without loading local credentials. Automated tests and Storybook use mocks.

For Google Cloud account creation, enabled APIs, key restrictions and validation, follow the [Google setup guide](integrations.md). On Unraid, add `TIDE_GOOGLE_MODE=live`, `GOOGLE_SERVER_API_KEY` and `GOOGLE_MAPS_BROWSER_KEY` as container environment variables. Apply changes and refresh Tide. Later key changes do not require rebuilding or publishing another image.

Unraid configuration:

| Field | Value |
|---|---|
| Image | `afbeals/tide:latest` or explicit version |
| Container | `tide` |
| Port | host 8776 → container 8776 |
| Volume | `/mnt/user/appdata/tide/data` → `/app/data` read/write |
| Data root | `TIDE_DATA_DIR=/app/data` |
| Database | `DATABASE_URL=file:/app/data/workspace.db` initially |
| Google live access | `TIDE_GOOGLE_MODE=live` only in production; disabled when unset |
| Google server key | `GOOGLE_SERVER_API_KEY` if configured |
| Google browser key | `GOOGLE_MAPS_BROWSER_KEY` if configured |
| Optional demo | `TIDE_SEED_DEMO=true` only for an empty workspace |

The included Compose file can build locally or run the published image. Start at `http://<unraid-ip>:8776`. No login or session secret is required. Do not expose this unrestricted shared workspace as a public service without separately designed access controls.

Startup resolves the active restored generation, makes a safety backup of an existing database, applies migrations, optionally seeds only an empty workspace, then starts Next. Health uses `/api/health`. Logs: `docker logs -f tide`.

For upgrades, create/download a full backup, select the tested new version and recreate the container while retaining the volume. For rollback, choose the previous image and restore a compatible pre-upgrade backup when schema changes require it. Image rollback alone does not downgrade database migrations. Do not delete the volume to repair a startup error.

Docker validation requires an available Docker daemon. The implementation environment's actual verification status is recorded in verification.md.

## Plain HTTP on the LAN

The planner supports `http://<unraid-ip>:8776`. Browser-side identifiers use `crypto.getRandomValues()` to create UUIDv4 values without depending on secure-context-only APIs. Unlike `localhost`, an HTTP LAN address is not a secure browser context: calling `crypto.randomUUID()` there can crash the page even when Docker logs and health checks are normal.

If an older image reports `crypto.randomUUID is not a function`, rebuild and publish the fixed image, then update the Unraid container using the workflow above. Keep the mounted data folder. Geolocation still requires a secure context; saved and manually entered locations remain available over LAN HTTP.

## Windows: entrypoint reports "no such file or directory"

If `npm run docker:test` reports `exec ./docker/entrypoint.sh: no such file or directory` after a successful image build, Windows CRLF line endings may have changed the script's interpreter from `/bin/sh` to `/bin/sh\r`. The script exists, but Linux cannot find that interpreter.

The repository enforces LF for shell scripts through `.gitattributes`, and the Dockerfile also removes carriage returns during the image build. After pulling this fix, rebuild the image before testing:

```sh
npm run docker:build
npm run docker:tag
npm run docker:test
```

Testing uses the version from `package.json`; tagging `latest` alone does not rebuild that image. Keep the existing `docker-data` folder: rebuilding the image does not require deleting the database.
