ALTER TABLE api_clients ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin'));
ALTER TABLE api_clients ADD COLUMN scopes TEXT NOT NULL DEFAULT 'conversations:read,conversations:write';
