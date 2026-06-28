-- User-managed activities: replace hardcoded enum with a table

-- 1. Create user_activities table
CREATE TABLE IF NOT EXISTS user_activities (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key          text        NOT NULL,
  label        text        NOT NULL,
  color        text        NOT NULL DEFAULT '#6366f1',
  emoji        text        NOT NULL DEFAULT '💼',
  position     int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);

ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_user_activities" ON user_activities;
CREATE POLICY "own_user_activities" ON user_activities
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2. Relax activity columns from enum to plain text
ALTER TABLE transactions ALTER COLUMN activity TYPE text USING activity::text;
ALTER TABLE budgets      ALTER COLUMN activity TYPE text USING activity::text;
ALTER TABLE receivables  ALTER COLUMN activity TYPE text USING activity::text;
ALTER TABLE purchases    ALTER COLUMN activity TYPE text USING activity::text;
ALTER TABLE categories   ALTER COLUMN activity TYPE text USING activity::text;
ALTER TABLE documents    ALTER COLUMN activity TYPE text USING activity::text;

-- 3. Seed default activities for every existing profile
INSERT INTO user_activities (user_id, key, label, color, emoji, position)
SELECT p.id, a.key, a.label, a.color, a.emoji, a.pos
FROM profiles p
CROSS JOIN (VALUES
  ('freelance',  'Freelance',  '#0ea5e9', '💼', 0),
  ('cle_avenir', 'CléAvenir',  '#f59e0b', '🏢', 1),
  ('hakily',     'Hakily',     '#10b981', '🤖', 2),
  ('alternance', 'Alternance', '#6366f1', '🎓', 3),
  ('personnel',  'Personnel',  '#ec4899', '🏠', 4)
) AS a(key, label, color, emoji, pos)
ON CONFLICT DO NOTHING;
