-- Migration 000: Extend userType constraint for new roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_usertype_check;
ALTER TABLE users ADD CONSTRAINT users_usertype_check
  CHECK (usertype IN ('merchant', 'trucker', 'admin', 'logistics', 'loader_company', 'highway_business', 'developer', 'tester', 'qa'));
