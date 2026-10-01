CREATE TABLE portfolio_revision (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL);
INSERT INTO portfolio_revision VALUES(1,0);

DROP TRIGGER transactions_insert;
DROP TRIGGER transactions_delete;
DROP TRIGGER transactions_update;
-- Editing source transactions invalidates affected derived values atomically.
CREATE TRIGGER transactions_insert AFTER INSERT ON transactions BEGIN
 UPDATE portfolio_revision SET version=version+1 WHERE id=1;
 DELETE FROM portfolio_daily WHERE date>=NEW.transaction_date; END;
CREATE TRIGGER transactions_delete AFTER DELETE ON transactions BEGIN
 UPDATE portfolio_revision SET version=version+1 WHERE id=1;
 DELETE FROM portfolio_daily WHERE date>=OLD.transaction_date; END;
CREATE TRIGGER transactions_update AFTER UPDATE ON transactions BEGIN
 UPDATE portfolio_revision SET version=version+1 WHERE id=1;
 DELETE FROM portfolio_daily WHERE date>=min(OLD.transaction_date,NEW.transaction_date);
 UPDATE transactions SET updated_at=CURRENT_TIMESTAMP WHERE id=NEW.id; END;
