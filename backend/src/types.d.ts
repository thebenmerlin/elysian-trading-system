/// <reference types="node" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      DATABASE_URL: string;
      ELYSIAN_API_KEY: string;
      RUNNER_TICKERS: string;
      ELYSIAN_LIVE: string;
      INITIAL_CASH: string;
      RUN_INTERVAL_MINUTES: string;
      AUTO_START_RUNNER: string;
      HF_API_KEY?: string;
      ENABLE_AI_ANALYSIS: string;
      LOG_LEVEL: string;
      MAX_DAILY_RUNS: string;
      FRONTEND_URL?: string;
    }
  }

  interface Error {
    code?: string;
    errno?: number;
    syscall?: string;
    address?: string;
    port?: number;
  }
}

export {};
