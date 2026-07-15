-- Records exactly WHEN an assignment was fulfilled, not just that it
-- was — this is what lets the Officer Activity report tell on-time
-- completion apart from late completion, instead of only knowing
-- "completed" vs "still pending".

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
