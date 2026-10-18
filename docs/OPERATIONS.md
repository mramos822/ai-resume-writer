# Operating Kaizo

What the code cannot do for you. Do these before launch and put them in a calendar.

## Backups and restore (MongoDB Atlas)
1. In Atlas open the cluster, then **Backup**, and turn on **Cloud Backup** (continuous or scheduled snapshots).
   Keep at least 7 daily and 4 weekly snapshots. The free shared tier (M0) has no backups: use a paid tier before real users arrive.
2. **Test a restore, do not trust it.** Every quarter: restore the latest snapshot into a NEW cluster, point a copy of the app
   at it (`MONGODB_HOST`) and check you can sign in, open a profile and download a resume. Write the date and how long it took here.
3. Firebase Authentication keeps accounts separately. Export them with `firebase auth:export accounts.json --project <id>` and
   store the file somewhere private and encrypted (it contains password hashes).

| Date | Who | Restore tested | Minutes it took | Notes |
|------|-----|----------------|-----------------|-------|
|      |     |                |                 |       |

## Monitoring
- `GET /api/health` answers 200 only when the database answers. Point an uptime monitor (UptimeRobot, Better Stack, ...) at it.
- Every API error carries an id (`requestId` in the JSON body, `x-request-id` header, and the same id in the server log line).
  When someone reports a problem, ask for that id and search the logs for it.

## Rate limits
`src/lib/rateLimit.ts` counts requests in memory, per server. With ONE server it is enough. With several servers (or serverless),
move the counters to a shared store (Redis/Upstash) or the limits are per instance.

## Database changes
Add a migration at the end of `src/lib/migrations.ts`. Never edit one that already ran. They run once, in order, and are recorded in
`schema_migrations`.

## Secrets
Everything secret lives in environment variables (`.env.local` locally, the host's settings in production). If a value was ever
pasted in a chat, a screenshot or a log, treat it as leaked and rotate it (database password, Firebase admin key, AI key, Adzuna key).

## Privacy requests
- Access and deletion are self-service in Settings (`/api/account`). Contact-form messages are in the `contact_messages` collection:
  read them, answer by email, and set `status` when done.
- When you add a new collection that holds user data, add it to `src/lib/accountData.ts` (export and delete) in the same change.

## Environment variables for the policies
| Variable | What for |
|----------|----------|
| `ADMIN_EMAILS` | Comma-separated emails (verified) that see **Messages** in the sidebar and can read contact messages. |
| `CONTACT_WEBHOOK_URL` | Optional Slack/Discord/Teams incoming webhook: a note for every new contact message. |
| `CRON_SECRET` | 16+ random characters. Lets a scheduler call `POST /api/admin/cleanup` (header `Authorization: Bearer <secret>`). |

## Retention (promised in the Privacy Policy)
- A guest session unused for 30 days is deleted with everything in it. This runs by itself, at most once an hour, whenever someone
  starts a guest session; a daily scheduler calling `/api/admin/cleanup` makes it exact.
- Contact messages older than 24 months are deleted by the same cleanup.
- Numbers live in `src/lib/retentionRules.ts`. Change the policy text in the same commit if you change them.

## Answering privacy requests
The policy promises an answer within 45 days. Open **Messages** (admins only) every week: anything marked amber is older than 30
days, red is older than 45. Use the **appeal** topic for people who disagree with an answer.

## If personal data leaks (incident)
1. Contain it: rotate the leaked secrets, disable the affected feature, keep the logs.
2. Find out whose data and what kind (the request id in the logs helps).
3. Notify the affected people and the authorities as the law requires: New Jersey requires notice to affected residents "in the most
   expedient time possible" and to the State Police before notifying customers; the GDPR requires 72 hours to the authority.
4. Write down what happened and what changed so it does not repeat.

## Computrabajo (Peru and Chile)
Read into the jobs index by `src/lib/ingest/computrabajo.ts`. It has no public API; its terms allow reading the postings (checked by the owner) and its
robots.txt leaves the postings and the searches by title open, so only those are read. It is slow on purpose:
- One request at a time, more than a second between any two; a run reads one board (a country and a group of searches, 14 in all) for about 50 seconds
  and at most 40 new postings; a posting already in the index is never read again.
- When the site answers 403 or 429 the run stops at once and the next one tries again. If it keeps happening, wait a day and lower `CT_NEW_PER_RUN`
  or raise `CT_PACE_MS`; do not retry in a loop (that is what got the IP blocked by Adzuna).
- Run it with `POST /api/admin/ingest-jobs` `{"only":"computrabajo","part":0..13}` and `Authorization: Bearer <CRON_SECRET>`. Without `part` the day of the
  year picks the board. `.github/workflows/ingest-computrabajo.yml` goes round all of them every eight hours (it needs `SITE_URL` and `CRON_SECRET`).
- A posting is closed when it has not been seen for ten days (the lists only show the newest postings of each search).
- To add a country: a line in `CT_SITES` (and the same number of parts in the workflow). To add searches: `CT_GROUPS`.
- What is kept: the text, the place, the pay, the date and the link to apply on Computrabajo; no person's data. Every job shows "Computrabajo" as its source.

## Other boards read into the index (one to thirty requests a day each)
- **Get on Board** (tech jobs of Latin America; `getonbrd.com/api/v0/search/jobs`, public, no key; its help says the public API is for showing its jobs on other sites):
  its search wants a filter, so it is read for `remote=true` and for each country of `GETONBOARD_COUNTRIES` (about thirty requests, with a pause). Pay is dollars a month.
- **Remote OK** (`remoteok.com/api`) and **Jobicy** (`jobicy.com/api/v2/remote-jobs`): remote jobs of the world. Their terms: name the board and link to its own page of the
  job (the "via ..." label and the job's link do it); do not use Remote OK's logo. Do not add Himalayas: its terms forbid giving its jobs to other aggregators.
- Not read, and why: Indeed, Glassdoor, ZipRecruiter, Monster, OCC (they refuse programs); Jooble, Careerjet, The Muse (keys or terms that do not let us keep the text);
  Arbeitsagentur (answered 403 from here); USAJOBS (needs a free key: a good next one for the United States).

## USAJOBS (federal jobs of the United States)
`USAJOBS_API_KEY` (free, requested at developer.usajobs.gov) and `USAJOBS_EMAIL` (the email it was requested with: the API wants it as the User-Agent) go in `.env.local`
and in the host's environment variables (Vercel). They are only sent in headers, never in an address or a log. The newest 2,000 jobs open to the public are read
each run (4 requests); a job leaves the index when its closing date has passed. Without the variables that board reports "not set" and nothing else changes.
