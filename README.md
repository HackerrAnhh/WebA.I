# WebBanA.I

Du an da duoc sap xep lai theo cau truc de de day GitHub va deploy Docker/Render.

## Cau Truc Thu Muc

```text
.
├── backend/          # Express API, package.json, package-lock.json
├── frontend/         # HTML, CSS, JS, PNG assets duoc server public
├── data/             # JSON data local runtime
├── docker/           # Dockerfile, compose, entrypoint seed data
├── backup/           # memories.md va script tao snapshot
├── docs/             # Tai lieu test/API note
├── render.yaml       # Render Blueprint
├── .dockerignore
├── .gitignore
└── package.json      # Script tien ich o root
```

## Chay Local Khong Can Docker

```powershell
npm --prefix backend install
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="11111111"
npm start
```

Mo:

- Web: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin.html`
- Health check: `http://localhost:3000/healthz`

## Chay Bang Docker

```powershell
docker compose -f docker/docker-compose.yml up --build
```

Container mount `./data` vao `/app/data`, nen cac thay doi don hang/san pham/user van ghi ve thu muc `data/` tren may local.

## Chuan Bi Day Len GitHub

```powershell
git init -b main
git add .
git commit -m "Initial WebBanAI source"
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

Khong day `node_modules/`, `.env`, `.claude/`, file Excel local va `backup/memories.md`. Cac file nay da duoc dua vao `.gitignore` hoac `.dockerignore`.

## Deploy Len Render

Co 2 cach:

1. Blueprint: day repo len GitHub, vao Render Dashboard -> Blueprints -> New Blueprint Instance -> chon repo co `render.yaml`.
2. Web Service thu cong: New Web Service -> Language `Docker` -> Dockerfile Path `docker/Dockerfile` -> Docker Context `.`.

Ung dung can bind `0.0.0.0` va dung bien moi truong `PORT` cua Render. `backend/server.js` da ho tro viec nay.

Khi tao service tren Render, bat buoc dat `ADMIN_PASSWORD` toi thieu 8 ky tu. Backend se dung bien nay de tao/cap nhat tai khoan admin luc khoi dong. Khong commit `data/data_user.json` len GitHub.

Huong dan chi tiet Docker/Render nam trong `docs/deploy-render-docker.md`.

### Luu Y Ve Data Tren Render Free

Du an hien luu data bang file JSON. `render.yaml` dang cau hinh `plan: free` va khong gan persistent disk, nen data ghi moi nhu don hang, user dang ky, san pham sua tu admin co the mat khi service restart/redeploy/spin down.

Neu can giu data on dinh, doi service sang paid plan va them persistent disk mount tai `/app/data`, hoac chuyen `data/*.json` sang Render Postgres.

Ve lau dai, nen chuyen `data/*.json` sang Render Postgres hoac mot database quan ly rieng neu site bat dau co nguoi dung that.

## Backup Snapshot

Tao lai backup:

```powershell
npm run snapshot
```

File backup duoc ghi vao `backup/memories.md`.

## Kiem Tra Nhanh

```powershell
npm run check
```
