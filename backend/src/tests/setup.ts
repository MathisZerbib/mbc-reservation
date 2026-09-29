// Dummy env so unit/smoke tests never require real secrets or a database.
// DB-backed suites stay opt-in behind RUN_DB_TESTS=1.
process.env.JWT_ACCESS_SECRET ??= 'test-secret';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.DIRECT_DATABASE_URL ??= process.env.DATABASE_URL;
process.env.FRONTEND_URL ??= 'http://localhost:5173';
