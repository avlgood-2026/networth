-- Synthetic prices, for local demonstration only.
INSERT OR IGNORE INTO transactions(id,ticker,transaction_date,type,quantity_delta) VALUES('demo-buy','AAPL','2026-09-28','BUY','10'),('demo-sell','AAPL','2026-09-30','SELL','-2');
INSERT OR IGNORE INTO daily_prices(id,ticker,date,close) VALUES('demo-p1','AAPL','2026-09-28','200'),('demo-p2','AAPL','2026-09-29','202'),('demo-p3','AAPL','2026-09-30','201');
INSERT OR IGNORE INTO portfolio_daily(id,date,market_value) VALUES('demo-v1','2026-09-28','2000.00'),('demo-v2','2026-09-29','2020.00'),('demo-v3','2026-09-30','1608.00');
