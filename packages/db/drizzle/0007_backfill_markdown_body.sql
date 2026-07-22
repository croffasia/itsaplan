-- Existing markdown fields rendered in the issue body before show_in_body
-- existed; keep that placement for them (new fields default to false).
UPDATE "custom_field" SET "show_in_body" = true WHERE "field_type" = 'markdown';
