-- Per-restaurant opening schedule (public widget grid + booking guard).
-- Null = legacy behavior (16:00-22:00 every day), so existing tenants are
-- unaffected until they save a schedule in Settings.
ALTER TABLE "RestaurantSettings" ADD COLUMN "openHours" JSONB;
