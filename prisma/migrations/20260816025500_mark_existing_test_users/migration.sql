UPDATE "users"
SET "isTest" = true
WHERE "userId" LIKE 'demo-user-%'
   OR "userId" LIKE 'local-%';
