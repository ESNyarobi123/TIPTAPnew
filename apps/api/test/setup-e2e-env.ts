/**
 * Runs before Jest loads modules. Ensures Phase 2 integration tests have env + DB URL.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test_jwt_access_secret_16chars_ok';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'test_jwt_refresh_secret_16chars_ok';
const pickDbUrl = (): string => {
  const e2e = process.env.E2E_DATABASE_URL?.trim();
  const direct = process.env.DATABASE_URL?.trim();
  const fallback = 'postgresql://postgres:postgres@localhost:5432/tiptap_test';
  return (e2e || direct || fallback) as string;
};
process.env.DATABASE_URL = pickDbUrl();
process.env.PAYMENTS_CREDENTIALS_SECRET =
  process.env.PAYMENTS_CREDENTIALS_SECRET ?? 'test_payments_credentials_secret_32b_ok!!';
