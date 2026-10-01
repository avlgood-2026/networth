CREATE TABLE transactions (
 id TEXT PRIMARY KEY, ticker TEXT NOT NULL CHECK(ticker=upper(ticker)),
 transaction_date TEXT NOT NULL CHECK(transaction_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
 type TEXT NOT NULL CHECK(type IN ('BUY','SELL','ADJUSTMENT')),
 quantity_delta TEXT NOT NULL CHECK(CAST(quantity_delta AS REAL) != 0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(type='ADJUSTMENT' OR (type='BUY' AND CAST(quantity_delta AS REAL)>0) OR (type='SELL' AND CAST(quantity_delta AS REAL)<0))
);
CREATE INDEX transactions_date_ticker ON transactions(transaction_date,ticker);
CREATE TABLE daily_prices (
 id TEXT PRIMARY KEY, ticker TEXT NOT NULL, date TEXT NOT NULL,
 close TEXT NOT NULL CHECK(CAST(close AS REAL)>0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(ticker,date)
);
CREATE TABLE portfolio_daily (
 id TEXT PRIMARY KEY, date TEXT NOT NULL UNIQUE, market_value TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Editing source transactions invalidates affected derived values atomically.
CREATE TRIGGER transactions_insert AFTER INSERT ON transactions BEGIN
 DELETE FROM portfolio_daily WHERE date>=NEW.transaction_date; END;
CREATE TRIGGER transactions_delete AFTER DELETE ON transactions BEGIN
 DELETE FROM portfolio_daily WHERE date>=OLD.transaction_date; END;
CREATE TRIGGER transactions_update AFTER UPDATE ON transactions BEGIN
 DELETE FROM portfolio_daily WHERE date>=min(OLD.transaction_date,NEW.transaction_date);
 UPDATE transactions SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
