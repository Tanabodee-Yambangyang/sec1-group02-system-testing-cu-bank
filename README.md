# CU Bank System Testing

CU Bank web application (React front-end, Node.js back-end, MongoDB) with automated system tests written in Playwright.

## Prerequisites

- Node.js (v18 or later) and npm
- A MongoDB database (MongoDB Atlas or local MongoDB)
- Ports **3000** (front-end) and **4000** (back-end) free
- Chromium for Playwright (installed in Terminal 3)

## Project structure

```
backend/     Node.js API (port 4000)
  config/    config.env.example (copy to config.env)
frontend/    React app (port 3000) and Playwright tests
  config/    config.env.example (copy to config.env)
  data/      CSV test data (scenario_input_*.csv)
  tests/     Playwright test files (scenario_*.spec.js)
```

## Setup and run

Open three terminals. Start them in order: back-end, front-end, then tests.

### Terminal 1: Back-end

```bash
cd backend
```

Create `backend/config/config.env` by copying the example:

```bash
# Windows cmd
copy config\config.env.example config\config.env
# Git Bash / macOS / Linux
cp config/config.env.example config/config.env
```

Open `config/config.env` and replace the placeholders:

- `MONGO_URI`: your MongoDB connection string (for example an Atlas URI)
- `JWT_SECRET`: any secret string of your choice

```
PORT=4000
NODE_ENV=development
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30
```

Install and start (run `npm install` only the first time):

```bash
npm install
npm run start
```

The API runs at `http://localhost:4000`.

### Terminal 2: Front-end

```bash
cd frontend
```

Create `frontend/config/config.env` by copying the example:

```bash
# Windows cmd
copy config\config.env.example config\config.env
# Git Bash / macOS / Linux
cp config/config.env.example config/config.env
```

Open `config/config.env` and replace `MONGO_URI` with your connection string:

```
MONGO_URI=your_mongodb_connection_string
MONGO_DB=test
CU_BANK_API_URL=http://localhost:4000
CU_BANK_URL=http://localhost:3000
CU_BANK_REGISTER_URL=http://localhost:3000/register
```

> `MONGO_URI` must be the **same connection string the back-end uses**, because some tests check the database directly.

Install and start (run `npm install` only the first time):

```bash
npm install
npm run start
```

The app runs at `http://localhost:3000`. If React asks to use another port, stop the process using port 3000 first, because the tests expect 3000.

### Terminal 3: Run the tests

Wait until the back-end and front-end are both running, then:

```bash
cd frontend
npx playwright install chromium    # first time only
npx playwright test
```

Run the whole suite in file order on the first run. `scenario_1.spec.js` registers the seed account `1234567890` / `1234`, which other scenarios (for example Scenario 3) depend on.

## Useful test commands

```bash
npx playwright test scenario_1.spec.js              # one file
npx playwright test -g "TC6.1"                      # one test by name
npx playwright test --headed                        # watch the browser
npx playwright test --ui                            # interactive UI mode
npx playwright show-report                          # open the HTML report
```

The HTML report opens automatically after a failed run. You can reopen it any time with `npx playwright show-report`.

## Notes

- **Expected failures:** some tests fail on purpose to show defects. For example, the Amount fields are number inputs, so for non-numeric or decimal values the browser's native validation appears instead of the specified error message.
- **Test output:** `test-results/` and `playwright-report/` are generated on each run and are git-ignored.

## Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED ... 27017` | `MONGO_URI` in `frontend/config/config.env` is not set to the real connection string |
| `Cannot find module 'csv-parse/sync'` | Run `npm install` in `frontend` |
| Tests time out at login | Check that the back-end (4000) and front-end (3000) are running |
| Atlas connection fails | Add your IP in Atlas, Network Access |
