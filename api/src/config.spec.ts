import { assertEnv } from './config';

describe('assertEnv', () => {
  const ok = { DATABASE_URL: 'd', REDIS_URL: 'r', WORKER_URL: 'w' };
  it('passa com tudo definido', () => expect(() => assertEnv(ok)).not.toThrow());
  it('falha nomeando a variável ausente', () => {
    expect(() => assertEnv({ ...ok, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });
});
