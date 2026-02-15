ALTER TABLE "user" ALTER COLUMN "total_request_quota" SET DEFAULT 500;
UPDATE "user" SET "total_request_quota" = 500 WHERE "total_request_quota" <> 500;
UPDATE "api_key" SET "request_quota" = 500 WHERE "request_quota" > 500;
