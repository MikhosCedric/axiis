-- An area's colour: one of a fixed palette of names, or null for none (ink).
--
-- The names match AREA_COLORS in src/domain/area-color.ts; the colours they
-- stand for are design tokens in src/app/globals.css, so the database stores a
-- name and never a hex value. Null is the default, so existing areas and new
-- signups look as they did before this migration.
--
-- No policy changes: the areas policies are per row and the table grants cover
-- every column, so a user sets the colour of their own areas only.
alter table public.areas add column color text;

alter table public.areas add constraint areas_color_palette
  check (color is null or color in ('clay', 'ochre', 'moss', 'sage', 'slate', 'plum', 'rose', 'stone'));
