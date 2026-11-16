# Kandhan C - Portfolio (FastAPI)

FastAPI + PostgreSQL portfolio with a 3D scroll background (Three.js), GSAP/Lenis scroll animation,
light/dark theme, project cards from the database, and a contact form that saves to the database
**and** emails you.

## 1. Run locally

```bash
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                 # Windows: copy .env.example .env
uvicorn app.main:app --reload
```

Open http://localhost:8000 (API docs at /docs). Run tests with `pytest`.
Locally it uses a SQLite file, so no database setup is needed.

## 2. Things you MUST fill in before going live

| What | Where |
|---|---|
| Your photo | Save as `app/static/img/profile.jpg` (portrait, about 800x1000). Until then a "KC" placeholder shows. |
| LinkedIn / GitHub URLs | `app/data/profile.json` (`linkedin`, `github`). Empty = hidden. |
| Certificate links | `app/data/profile.json` -> `certifications[].url`. Empty = no link shown. |
| Project GitHub / live links, real screenshots | `app/data/projects.json` (`github_url`, `live_url`, `image_url`) |
| More projects | Add an object to `app/data/projects.json`. Redeploy and it appears (the database syncs on start). |
| Phone number | Shown publicly. Delete `"phone"` in `profile.json` if you do not want it public. |
| Your domain | `SITE_URL` environment variable. |

`image_url` can be any online image URL, or a local file such as `/static/img/my-project.png`.
The sample images are random photos from picsum.photos, so replace them with real screenshots.

## 3. Free deployment (Render + Neon + Resend)

### a) Database - Neon (free, does not expire)
1. neon.tech -> create a project -> copy the **connection string** (`postgresql://...?sslmode=require`).
2. That whole string is your `DATABASE_URL`. No changes needed; the app converts it automatically.

### b) Email - Resend (free)
Render's free plan **blocks SMTP ports**, so Gmail SMTP will not work there. Resend uses HTTPS instead.
1. resend.com -> sign up **with kandhanchandrasekar@gmail.com** -> API Keys -> create a key.
2. With the default sender `onboarding@resend.dev`, Resend only delivers to the email you signed up with,
   which is exactly what you need (enquiries come to you).
3. Later, to send from your own domain: Resend -> Domains -> add your domain, add the DNS records it shows,
   then set `MAIL_FROM=Portfolio <contact@yourdomain.com>`.

### c) Web app - Render (free)
1. Push this folder to a GitHub repository (`.env` and `*.db` are already git-ignored).
2. render.com -> New -> **Blueprint** (uses `render.yaml`) or New -> Web Service -> Docker.
3. Set environment variables: `DATABASE_URL` (Neon), `RESEND_API_KEY`, `SITE_URL` (https://yourdomain.com),
   `NOTIFY_EMAIL`, `MAIL_FROM`.
4. Deploy. Check `https://<your-app>.onrender.com/health` returns `{"status":"ok"}`.

### d) Your domain
Render -> your service -> Settings -> Custom Domains -> add your domain. Render shows the exact DNS
records (CNAME for `www`, and A/ALIAS for the root domain) to add at your registrar. HTTPS is automatic.

### e) Free-tier behaviour to know
- Render free apps **sleep after ~15 minutes** without traffic; the first visit then takes about 30-60 seconds.
  A free UptimeRobot monitor pinging `/health` every 5 minutes keeps it awake.
- Messages are saved in the database **before** the email is attempted, so nothing is lost even if
  email fails. View them in Neon -> SQL Editor: `select * from contact_messages order by id desc;`
  (`email_sent` shows whether the mail went out).

## 4. Project layout

```
app/main.py            routes: /, /api/projects, /api/contact, /health
app/email_service.py   Resend (HTTPS) or SMTP sender
app/models.py          Project, ContactMessage tables
app/data/*.json        your profile + projects (edit these)
app/templates/         index.html (Jinja2)
app/static/            css, js, vendored libraries, resume PDF
tests/                 pytest suite
Dockerfile, render.yaml
```
