# On-demand AWS test environment

The test environment is separate from the production deployment. It uses the
`fts-matt` AWS profile in account `777439247518`, region `us-east-2`.

Deployed and verified on **2026-10-07** as IAM user `FTS-Matt` in the
`UT - Austin - ENGR-Prod` account. The `default` profile in this account uses
`FTS-VIDEO`; deployment commands explicitly use `fts-matt`.

## Deployment inventory

| Resource | Identifier |
| --- | --- |
| EC2 instance | `i-0d273255104be9b87` (`pge-shop-test`) |
| Instance type | `t3.small`, Ubuntu 24.04, standard CPU credit mode |
| Root disk | 16 GiB encrypted gp3; deleted on instance termination |
| VPC | `vpc-ec1f1f84` |
| Subnet | `subnet-76fbd31e` (`us-east-2a`) |
| Security group | `sg-0174df3c62d13d9ca` |
| EC2 SSH key pair | `pge-shop-test-b41e28` |
| IAM role and instance profile | `pge-shop-test-b41e28` |
| Inline IAM policy | `TestAttachments` |
| Private S3 bucket | `pge-shop-test-777439247518-b41e28` |
| Server project directory | `/home/ubuntu/pge-shop-test` |
| GitHub Actions runner | `pge-shop-test` (`/home/ubuntu/actions-runner`, systemd service) |
| App URL at verification | `https://3.144.3.61/` |
| Captured email URL at verification | `https://3.144.3.61:8443/` |

URLs are a deployment snapshot, not permanent addresses. Run the status command
below for the current public IP. The initial allowed network was
`128.62.209.80/32`; the start command updates it to the invoking workstation's
current public IP.

An EC2 `t3.small` instance runs the app, PostgreSQL, Mailpit, and a Caddy HTTPS proxy. Test attachments
use a private S3 bucket through a bucket-scoped EC2 IAM role. Emails are captured
by Mailpit. The test database contains generated users and dummy jobs.

The instance requires IMDSv2, with a metadata response hop limit of 2 so the
app container can obtain its IAM role credentials. The role permits only
`GetObject`, `PutObject`, and `DeleteObject` on objects in the test bucket.
S3 public access is blocked. PostgreSQL and SMTP have no public host ports.

## Start and stop

From the project directory:

```sh
python3 scripts/aws-test.py start
python3 scripts/aws-test.py status
python3 scripts/aws-test.py stop
```

Start prints the current app and Mailpit URLs. The public IP can change after a
stop/start; the script updates the app URL and access rules for your current
public IP. Access is restricted to that IP on ports 22 (SSH), 443 (app HTTPS),
and 8443 (Mailpit HTTPS). Port 80 is open publicly for certificate validation
and redirects HTTP requests to the app HTTPS URL. The app and Mailpit have no
direct public container ports. Test accounts use generated credentials.

Stopping retains the database, captured emails, and S3 attachments. EC2 compute
charges stop once the instance is stopped. The 16 GiB EBS disk and S3 storage
remain billable. No Elastic IP, load balancer, NAT gateway, or RDS instance is used.

If authentication expires, sign in again:

```sh
~/.local/aws-cli/aws login --profile fts-matt
```

AWS CLI 2.37.10 was installed at `~/.local/aws-cli/aws`; the older system CLI
does not support the browser login used by this profile. The control script
prefers this local CLI, or accepts an `AWS_CLI` environment override. Browser
login requires `SignInLocalDevelopmentAccess` permissions on the IAM identity.

Local deployment state and the SSH key are in `~/.config/pge-shop-test/`.
The generated test login password is in `~/.config/pge-shop-test/login.txt`.
These files are outside the repository. The server's environment file is
`/home/ubuntu/pge-shop-test/.env`.

`~` is per macOS user. These files were created under the `bollox` account, so
`~/.config/pge-shop-test/` does not exist when you are signed in as another
user such as `bollox-admin`, and `aws-test.py` and the deploy commands will not
find their state there. Run them as `bollox`. To read a file from another
account use the absolute path with `sudo`, for example
`sudo cat /Users/bollox/.config/pge-shop-test/login.txt`. If you copy the
folder to another user, keep it private (`chmod 700`): it holds the SSH private
key.

Test logins are `admin@utexas.edu`, `machinist@utexas.edu`, and
`requestor@utexas.edu`. They share the generated password recorded in the local
login file. No passwords or AWS credentials are stored in this document.

Back up the private deployment directory securely if you need to manage the
environment from another workstation. The control script requires its
`environment.json` and SSH private key; the private key cannot be recovered
from the AWS key pair.

## Deploy an update

From the local project directory, this reads the current IP from the status
command and preserves the server's test `.env`:

```sh
TEST_IP=$(python3 scripts/aws-test.py status | sed -n 's#^App: https://\([^/:]*\).*#\1#p')
rsync -az --exclude='.git' --exclude='.env*' --exclude='node_modules' \
  --exclude='.next' --exclude='.next-dev' --exclude='*.tsbuildinfo' \
  -e "ssh -i $HOME/.config/pge-shop-test/id_ed25519 -o UserKnownHostsFile=$HOME/.config/pge-shop-test/known_hosts -o StrictHostKeyChecking=accept-new" \
  ./ "ubuntu@$TEST_IP:/home/ubuntu/pge-shop-test/"
ssh -i "$HOME/.config/pge-shop-test/id_ed25519" \
  -o "UserKnownHostsFile=$HOME/.config/pge-shop-test/known_hosts" \
  "ubuntu@$TEST_IP"
```

Then run on the test instance:

```sh
cd /home/ubuntu/pge-shop-test
docker compose -f docker-compose.test.yml up -d --build
```

If the release adds files to `migrations/`, apply them once before
rebuilding. They are safe to run twice, and neither the manual steps above nor
the CI/CD deploy job runs them for you:

```sh
docker compose -f docker-compose.test.yml exec -T db \
  psql -U pgeshop -d pge_shop -v ON_ERROR_STOP=1 < migrations/001-password-reset-tokens.sql
```

For a fresh test database only, seed with:

```sh
docker compose -f docker-compose.test.yml run --build --rm seed
```

The seed service reads `SEED_PASSWORD` from the test environment file. Seeding
does not reset existing users' passwords and skips jobs when jobs already exist.
The test init SQL removes the default schema admin before seeding.

The initial build briefly used unlimited CPU credit mode to complete the build;
standard mode was restored and verified afterward. Builds in standard mode can
be slow on this small instance.

## CI/CD and the self-hosted runner

`.github/workflows/ci-cd.yml` runs on the GitHub host
(`github.austin.utexas.edu/bollox/pge-shop`). That host has no GitHub-hosted
runners (a job on `ubuntu-latest` stayed queued), so both jobs use the
self-hosted runner `pge-shop-test`, which lives on the test instance:

- **`test`** (pushes and pull requests to `main`): `npm ci`, typecheck, lint,
  tests and a build with dummy environment values.
- **`deploy`** (pushes to `main` only, after `test` passes): rsyncs the
  checkout into `/home/ubuntu/pge-shop-test`, keeping the server's `.env`, then
  runs `docker compose -f docker-compose.test.yml up -d --build`. Volumes
  (database, captured email, Caddy certificates) are kept. There is no
  `production` approval gate.

Because the runner is on the on-demand instance, **jobs wait in the queue while
the instance is stopped** and run once it is started. Merging to `main` while
the instance is stopped therefore delays the deploy rather than failing it.

The runner is installed in `/home/ubuntu/actions-runner` as the systemd service
`actions.runner._services.pge-shop-test.service`, so it restarts with the
instance. It has the labels `self-hosted`, `Linux`, `X64` and `pge-shop-test`.
The old runner `pge-shop-ec2`, which belonged to the retired deployment in
account `645684341804`, was deleted.

To re-register it (for example after rebuilding the instance), get a short-lived
token with `gh api -X POST repos/bollox/pge-shop/actions/runners/registration-token`
(with `GH_HOST=github.austin.utexas.edu`), then on the instance run
`./config.sh --unattended --replace --url https://github.austin.utexas.edu/bollox/pge-shop --token <token> --name pge-shop-test`
followed by `sudo ./svc.sh install ubuntu && sudo ./svc.sh start`. Do not paste the
token into shared logs.

Security: pull-request builds run on this runner, which has Docker access and
the instance's S3 role. That is acceptable while the environment holds only dummy
data. Before it holds real data, restrict which workflows can use the runner or
move `test` to an ephemeral runner (see `docs/SECURITY-REVIEW.md`, finding 6).

Verified 2026-10-07: the `test` job passed on this runner for pull request 6
(typecheck, lint, tests and build). The `deploy` job has not yet run from CI;
the same steps were run by hand and worked.

## HTTPS and certificate renewal

`Caddyfile.test` configures a publicly trusted Let's Encrypt certificate for the
instance's public IP using the `shortlived` ACME profile. HTTP redirects to HTTPS;
the Mailpit web interface uses HTTPS on port 8443. Caddy's default SNI is the
public IP so clients that omit SNI for IP addresses still receive the certificate.

The certificate validates using HTTP-01 on port 80. Keep its public security
rule in place for issuance and renewal; HTTPS access remains restricted to the
workstation's public IP. TLS-ALPN validation is disabled because port 443 is
restricted. PostgreSQL, the app's port 3000, and Mailpit's ports 1025 and 8025
are reachable only inside the Docker network.

Caddy renews certificates automatically while the instance is running. Its
`caddy_data` volume persists ACME credentials and certificates, and
`caddy_config` persists configuration. Do not remove these volumes during
routine updates. If the instance was stopped long enough for a certificate to
expire, or its public IP changes, start waits for a valid certificate before
printing the new URLs. There is no Elastic IP or paid load balancer.

References: [Let's Encrypt IP certificates](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability),
[Caddy ACME configuration](https://caddyserver.com/docs/caddyfile/directives/tls).

## Troubleshooting

- **Expired AWS login:** run the browser login command above, then retry.
- **App unreachable after changing networks:** run `python3 scripts/aws-test.py start`
  to refresh the access rules, even if the instance is already running.
- **Stale URL after restarting:** use the URL printed by start or status. Start
  updates `NEXTAUTH_URL` and `TEST_PUBLIC_IP` in the remote environment and
  recreates the app and proxy containers as needed. It waits for a trusted HTTPS response.
- **Database or app error:** SSH to the instance and inspect
  `docker compose -f docker-compose.test.yml ps` and
  `docker compose -f docker-compose.test.yml logs --tail=100 app db proxy` from the
  server project directory. Avoid printing the environment file into shared logs.
- **Missing local deployment state:** restore the private deployment directory
  from your backup. Resource identifiers above help locate the AWS resources,
  but do not replace the SSH private key.

## Deployment changes and validation

`docker-compose.test.yml` defines the separate test stack. `scripts/aws-test.py`
controls its lifecycle and checks the AWS account before making changes.
`.dockerignore` excludes local secrets, dependencies, and build output from
Docker builds. `lib/s3.ts` uses explicit credentials when configured, otherwise
the AWS credential provider chain supplies the EC2 role credentials.

The test deployment uses real S3 because the original MinIO container image
could not be pulled. Inter is bundled under `public/fonts/` with its OFL license
and loaded using `next/font/local`, avoiding font download failures during
server builds. The seed script accepts `SEED_PASSWORD` and no longer prints the
password in its output; local seeding still defaults to `password123`.

Verification on 2026-10-07:

- Typechecking, all 72 automated tests, and local and EC2 production builds passed.
- The test homepage returned HTTP 200.
- Admin, machinist, and requestor credentials authenticated with their expected roles.
- Seeding created seven users and 65 dummy jobs.
- A requestor created a verification job and uploaded a PDF to private S3.
- Its presigned download returned the original bytes, and Mailpit captured the notification.
- The stop/start commands were exercised. The public IP changed, the app URL
  updated, and the saved job, S3 attachment, and captured email remained available.
- The verification job and attachment were deleted after the persistence check.
- The final instance state was running, with standard CPU credit mode restored.

HTTPS verification on 2026-10-07:

- HTTPS certificate trust and the IP subject alternative name validated without
  bypassing certificate checks; the negotiated connection used TLS 1.3.
- The app and Mailpit returned HTTP 200 over HTTPS; HTTP redirected to HTTPS.
- All three roles authenticated over HTTPS with secure session cookies.
- Job creation, S3 upload/download, and a new captured notification passed over HTTPS.
- Another stop/start changed the public IP. Start updated the app and proxy,
  obtained a new trusted IP certificate, and returned a healthy HTTPS URL.
- Existing dummy data and captured messages remained available after that restart.

Login hardening verification on 2026-10-07 (code from the login-hardening pull
request, 7, deployed to the instance; the migration was applied by hand):

- Applied `migrations/001-password-reset-tokens.sql` to the test database and
  rebuilt the app. Only dummy data was affected.
- An end-to-end script against the live instance passed 29 of 29 checks: security
  headers; an unknown email's reset request answered 200 and sent no mail; an admin
  creating a user without a password sent a set-password email to Mailpit; that
  link set a password once and could not be reused; a newer reset link voided the
  older one; five failed sign-ins locked the account even for the right password,
  and a password reset cleared the lockout; the access-request form answered
  identically for an existing and a new email. The temporary user was deactivated.
- Password reset and set-password emails appear in Mailpit at the captured email
  URL. Sign-in lockouts are held in the app's memory, so
  `docker compose -f docker-compose.test.yml restart app` clears them.
- The test accounts use the generated password in `login.txt`, not the
  local-development default `password123`. Five wrong attempts for an email lock
  it for 15 minutes.

## Remove the environment

Stopping is reversible; deleting is not. To remove it permanently, terminate
the instance (its EBS volume deletes with it), empty and delete the test S3
bucket, and remove the test security group, EC2 key pair, instance profile,
and IAM role with its inline policy. Resource identifiers are recorded in the
local deployment state file.

The GitHub Actions workflow now targets this test instance instead of the retired
deployment; see "CI/CD and the self-hosted runner". Changes reach the instance
by merging to `main`, or by the manual rsync steps in "Deploy an update".
