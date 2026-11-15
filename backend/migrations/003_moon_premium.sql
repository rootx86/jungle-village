-- Jobs were removed. Premium members and long-term subscribers live on the Moon.
ALTER TABLE subscribers DROP COLUMN IF EXISTS job;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS premium BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS moon_x INTEGER;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS moon_y INTEGER;
