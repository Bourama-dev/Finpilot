-- Add 'freelance' value to activity_type enum
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'freelance';
