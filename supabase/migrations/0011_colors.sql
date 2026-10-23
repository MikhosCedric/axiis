-- A larger palette, and a colour for tags.
--
-- The palette grows from eight names to twelve (terracotta, mustard, indigo and
-- mauve join). The names match AREA_COLORS in src/domain/area-color.ts; the
-- colours they stand for are design tokens in src/app/globals.css, so the
-- database stores a name and never a hex value. Every name 0009 allowed is still
-- allowed, so no stored area breaks the new check.
--
-- tags.color takes the same palette, or null for none. Null is the default, so
-- every existing tag and every tag made from capture looks as it did.
--
-- No policy changes: the areas and tags policies are per row and the table
-- grants cover every column, so a user colours their own areas and tags only.
alter table public.areas drop constraint areas_color_palette;

alter table public.areas add constraint areas_color_palette
  check (color is null or color in ('clay', 'terracotta', 'ochre', 'mustard', 'moss', 'sage', 'slate', 'indigo', 'plum', 'mauve', 'rose', 'stone'));

alter table public.tags add column color text;

alter table public.tags add constraint tags_color_palette
  check (color is null or color in ('clay', 'terracotta', 'ochre', 'mustard', 'moss', 'sage', 'slate', 'indigo', 'plum', 'mauve', 'rose', 'stone'));
