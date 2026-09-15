# NTAXCO – Login Fix

## What was fixed
- Admin, Employee, Agent and Customer login now use the same `/api` authentication path during local development.
- Both React apps proxy `/api` to FastAPI at `127.0.0.1:8001`.
- This removes the common direct-browser `localhost:8001` / CORS connection failure.
- Production builds can still override `REACT_APP_API_URL` with the real backend URL.

## Run the project

### 1. Start MongoDB
Make sure MongoDB is running because the authentication service stores users/sessions in MongoDB.

### 2. Start backend
```powershell
cd ntaxcos_fixed\backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```

Check:
`http://localhost:8001/api/health`

It should return a JSON response containing `"status": "ok"`.

### 3. Start internal/admin portal
Open another terminal:
```powershell
cd ntaxcos_fixed\frontend
npm install
npm start
```
Open:
`http://localhost:3000`

### 4. Start customer portal
Open another terminal:
```powershell
cd ntaxcos_fixed\customer
npm install
npm start
```
Open:
`http://localhost:3001`

## Login
Email + password login is handled by the backend. Use the credentials configured in `backend/.env` / your existing project configuration.

## If you still see "Unable to connect"
Open `http://localhost:8001/api/health` first.

- If it does not open: the FastAPI backend is not running or MongoDB is unavailable.
- If it opens: restart the React app after changing `.env`/`package.json` so the new proxy configuration is loaded.
