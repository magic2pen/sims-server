-- Adds storage for individual photos and the signature, separate from
-- the PDF. Until now these only existed embedded inside the PDF —
-- this is what lets the Portal show an actual photo gallery.

ALTER TABLE inspections ADD COLUMN IF NOT EXISTS photos_json TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS signature_base64 TEXT;
