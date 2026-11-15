-- The worlds are now infinite and houses are spread much further apart.
-- Tile ids are recomputed (they now support negative coordinates) and Moon homes are re-placed on the new Moon.
UPDATE subscribers SET tree_id = (house_x + 16384) * 32768 + (house_y + 16384);
UPDATE subscribers SET moon_x = NULL, moon_y = NULL;
