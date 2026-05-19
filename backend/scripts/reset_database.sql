-- Wipe all application data and Django migration history (PostgreSQL).
-- Run once after replacing migrations or when schema is inconsistent.
--
-- Example:
--   psql -h HOST -U USER -d DBNAME -f backend/scripts/reset_database.sql

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO CURRENT_USER;
GRANT ALL ON SCHEMA public TO public;
