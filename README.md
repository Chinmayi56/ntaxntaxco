# NTAXCO Local Run Guide

This package contains three applications: `backend`, `frontend` (admin/internal portal), and `customer`.

## Important
Both React apps are configured to use the FastAPI backend on **port 8001**. Do NOT start the backend on port 8000 for this package, otherwise the frontends will show connection errors.

## 1. Backend
Open Terminal 1:

```powershell
cd ntaxcos\backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

If the virtual environment already exists, skip the first two commands.

Backend: http://localhost:8001
Swagger: http://localhost:8001/docs

## 2. Admin / Frontend
Open Terminal 2:

```powershell
cd ntaxcos\frontend
yarn install
yarn start
```

Admin: http://localhost:3000

## 3. Customer
Open Terminal 3:

```powershell
cd ntaxcos\customer
yarn install
yarn start
```

Customer: http://localhost:3001

## If you see "Unable to connect"
1. Make sure Terminal 1 shows Uvicorn running on port **8001**.
2. Open http://localhost:8001/docs in the browser.
3. Keep the backend terminal running.
4. Start the admin and customer apps with **Yarn** as shown above.
5. Use `http://localhost:3000` for admin and `http://localhost:3001` for customer.
6. If you previously ran a different backend on port 8000, stop it and restart this backend on 8001.

The frontend and customer apps are configured to use the same-origin `/api` path in local development. Their `package.json` files proxy `/api` to FastAPI on `http://127.0.0.1:8001`, so the browser no longer connects directly to `localhost:8001` and CORS is not involved in local login.

```text
REACT_APP_API_URL=/api
proxy=http://127.0.0.1:8001
```

For production, replace `REACT_APP_API_URL` with the real backend URL ending in `/api`, or keep `/api` only when your hosting/reverse proxy forwards `/api` to the FastAPI backend. Rebuild after changing it.


## Connection-safe setup

- The frontend and customer app both use the same API URL resolver. When you open a dev app using the computer's LAN address (for example `http://192.168.x.x:3000`), a configured `localhost:8001` API is automatically changed to that same machine's host on port `8001`.
- For production, set `REACT_APP_API_URL` to the real backend URL ending in `/api`, or use `/api` when a reverse proxy serves the backend on the same domain. React environment values are embedded at build time, so rebuild after changing them.
- The backend must be reachable and MongoDB must be reachable from the backend. If the backend process cannot connect to MongoDB, login cannot succeed in any portal.
- All four roles use the same authentication API: Super Admin, Employee, Agent, and Customer.


## Authentication fix included

The login flow for Super Admin, Employee, Agent, and Customer uses the same FastAPI authentication service. The frontend apps now use `/api` locally and proxy that path to port 8001. This prevents the common browser error where a frontend opened on a different host/port tries to call a stale `localhost:8001` URL directly.

Before testing login, verify:

```powershell
cd ntaxcos\backend
uvicorn server:app --host 0.0.0.0 --port 8001
```

Then open `http://localhost:8001/api/health`. It must return a JSON response with `"status": "ok"`.

If `/api/health` does not respond, the backend is not running or MongoDB is unavailable. Login cannot work until the backend starts successfully.

## Business-module implementation notes

See `docs/ERP_MODULES.md` for the implemented business modules, access-control model, API groups and invoice/compliance rules. See `docs/TEST_RESULTS.md` for verification performed in the packaging environment and its dependency limitations.
