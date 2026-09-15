# NTAXCO Customer Frontend

Independent customer portal for NTAXCO ERP. It uses the shared FastAPI + MongoDB backend.

## Local

```bash
corepack enable
yarn install
yarn start
```

Open http://localhost:3001.

Set `REACT_APP_API_URL` to the shared backend `/api` URL.

## Production

Set `REACT_APP_API_URL` in the hosting platform before `yarn build`, for example `https://YOUR-BACKEND-DOMAIN/api`.
