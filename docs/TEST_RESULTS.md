# NTAXCO ERP — Verification Results

Date: 2026-09-12

## Passed

- Python syntax compilation: `python -m py_compile backend/*.py`
- Babel JSX parsing of modified Admin Dashboard and Customer Dashboard/Profile files.

## Environment limitations

- Full backend pytest suite could not execute because the packaged environment does not contain `pytest-xdist` and the system Python is missing `mongomock_motor`/`bcrypt`. The repository's pytest configuration requires xdist.
- React production builds were started for both the existing applications, but the build process did not finish within the execution window in this environment. No build error was produced before timeout.

## Recommended final verification on the target machine

1. Install `backend/requirements.txt` in a fresh Python virtual environment.
2. Start MongoDB and configure `backend/.env`.
3. Run `pytest -q` from `backend` so the repository's xdist configuration is used.
4. Run `yarn build` in both `frontend` and `customer`.
5. Test all four roles, including cross-customer record access, file permissions, leave approval, payment idempotency and the lead → customer → booking → project → invoice workflow.
