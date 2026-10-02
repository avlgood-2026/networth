CREATE TABLE assets (
 ticker TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('stock','crypto')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO assets(ticker,kind) SELECT DISTINCT ticker,'stock' FROM transactions;
CREATE TABLE login_attempts (
 ip TEXT PRIMARY KEY,
 window_start INTEGER NOT NULL,
 attempts INTEGER NOT NULL
);
