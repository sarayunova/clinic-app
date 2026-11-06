-- Add index on visits.follow_up_date for fast upcoming follow-up and recall list queries.
CREATE INDEX IF NOT EXISTS idx_visits_follow_up ON visits(follow_up_date);
