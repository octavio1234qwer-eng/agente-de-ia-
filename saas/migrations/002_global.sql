-- Mercado global: idioma, moneda y país de cada usuario.
ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'es';
ALTER TABLE users ADD COLUMN currency TEXT NOT NULL DEFAULT 'mxn';
ALTER TABLE users ADD COLUMN country TEXT;
ALTER TABLE users ADD CONSTRAINT users_currency_check CHECK (currency IN ('mxn', 'usd'));
