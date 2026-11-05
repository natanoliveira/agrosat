const REQUIRED = ['DATABASE_URL', 'REDIS_URL', 'WORKER_URL'] as const;

export function assertEnv(env: NodeJS.ProcessEnv = process.env): void {
  const missing = REQUIRED.filter((k) => !env[k]?.trim());
  if (missing.length) {
    throw new Error(`Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}. Copie .env.example para .env e preencha.`);
  }
}
