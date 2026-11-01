-- 1. Failed-login counts and lockouts survive a server restart (they were in memory).
CREATE TABLE login_attempts (
  username     TEXT PRIMARY KEY,          -- lower-cased
  fails        INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0, -- epoch milliseconds
  updated_at   TEXT NOT NULL
);

-- 2. Screen lock: a locked session stays signed in but every request except "unlock" and "log out" is refused,
--    so a reload of the page or a second tab cannot get past it.
ALTER TABLE sessions ADD COLUMN locked_at TEXT;

-- 3. Price list: standard charges that can be added to an invoice in one tap. Invoice lines copy the name and price,
--    so changing the list never changes an invoice that already exists.
CREATE TABLE price_items (
  id          INTEGER PRIMARY KEY,
  category    TEXT NOT NULL CHECK (category IN ('consultation','investigation','procedure','room_bed','other')),
  name        TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(name)) >= 1),
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0 AND price_paise <= 1000000000),
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX uq_price_items_name ON price_items(category, name);
CREATE TRIGGER price_items_no_delete BEFORE DELETE ON price_items
BEGIN SELECT RAISE(ABORT, 'price list items cannot be deleted; switch them off instead'); END;
