# Deploy Docker/Render

## Cai Docker Desktop Tren Windows

Docker Desktop can quyen Administrator va WSL 2 hoac Hyper-V. Cach ngan gon nhat tren may Windows co `winget`:

```powershell
winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
```

Neu installer bao loi WSL, mo PowerShell bang Run as administrator va chay:

```powershell
wsl --install
wsl --update
```

May co the yeu cau restart. Sau khi cai xong, mo Docker Desktop mot lan, accept license, roi kiem tra:

```powershell
docker --version
docker compose version
```

## Chay Docker Local

Tu repo root:

```powershell
docker compose -f docker/docker-compose.yml up --build
```

Mo:

- `http://localhost:3000/`
- `http://localhost:3000/admin.html`
- `http://localhost:3000/healthz`

Dung container:

```powershell
docker compose -f docker/docker-compose.yml down
```

## Deploy Len Render Bang Blueprint

1. Day repo len GitHub. Dam bao repo co `render.yaml`, `docker/Dockerfile`, `backend/package-lock.json`, `frontend/` va `data/`.
2. Vao Render Dashboard -> Blueprints -> New Blueprint Instance.
3. Chon repo co file `render.yaml`.
4. Review service `webbanai`, sau do Deploy Blueprint.

`render.yaml` dang dung:

- `runtime: docker`
- `dockerfilePath: docker/Dockerfile`
- `dockerContext: .`
- `healthCheckPath: /healthz`
- `plan: free`
- khong gan persistent disk

Luu y: Free web service khong ho tro persistent disk. App van deploy duoc de demo, nhung cac don hang/san pham/user ghi moi vao file JSON co the mat khi service restart/redeploy/spin down.

## Deploy Thu Cong Tren Render

1. New -> Web Service.
2. Connect GitHub repo.
3. Language: Docker.
4. Dockerfile Path: `docker/Dockerfile`.
5. Docker Context: `.`.
6. Environment variables:
   - `NODE_ENV=production`
   - `HOST=0.0.0.0`
   - `PORT=10000`
   - `FRONTEND_DIR=/app/frontend`
   - `DATA_DIR=/app/data`
   - `JWT_SECRET=<tao gia tri random manh>`
   - `ADMIN_USERNAME=admin`
   - `ADMIN_PASSWORD=<mat khau admin toi thieu 8 ky tu>`
7. Instance type: Free.

## Luu Y

Render web service phai bind `0.0.0.0` va dung `PORT` Render cap. Khi can giu data that, dung paid instance co persistent disk mount `/app/data` hoac chuyen sang database.
