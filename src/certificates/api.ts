// EduChain certificates — the client side of the API.
//
// Everything the browser can know lives in these types. Note what is NOT here: there is no field
// for a correct answer, no per-question right/wrong, and no answer key in the result. That is not a
// UI decision — the server never sends them (see server/certificates/index.cjs).
const BASE = "/api/certificates";

export type Option = { pos: number; text: string };
export type Question = {
  index: number;
  total: number;
  topic: string;
  level: number;
  text: string;
  options: Option[];
};

export type StartResult = { regId: string; emailSentTo: string; expiresInSeconds: number; attemptsLeft: number };
export type AttemptStart = { attemptId: string; total: number; passPct: number; expiresAt: number; question: Question };
export type AnswerResult = { answered: number; total: number; question: Question | null; done: boolean };
export type FinishResult = {
  scorePct: number;
  correct: number;
  total: number;
  passPct: number;
  passed: boolean;
  retryAfterSeconds?: number;
  maxAttemptsPerDay?: number;
  serial?: string;
  verifyUrl?: string;
  issuedDate?: string;
  chainTx?: string;
  mailSent?: boolean;
  explorer?: string;
};
export type VerifyResult = {
  serial: string;
  found: boolean;
  valid: boolean | null;
  chainReachable: boolean;
  revoked: boolean | null;
  course: { id: number; name: string };
  issuedDate: string | null;
  scorePct: number | null;
  holderName: string | null;
  organisation: string | null;
  position: string | null;
  registry: string;
  chainId: number;
  explorer: string;
  revokedAt?: string;
  reasonCode?: number;
  reason?: string;
  reasonText?: string;
  minimised?: boolean;
};

/** An API error that carries the server's machine-readable code, so the UI can translate it. */
export class CertApiError extends Error {
  code: string;
  status: number;
  data: Record<string, unknown>;
  constructor(status: number, data: Record<string, unknown>) {
    super(String(data?.error || `http_${status}`));
    this.code = String(data?.error || `http_${status}`);
    this.status = status;
    this.data = data || {};
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new CertApiError(res.status, data);
  return data as T;
}

export const certApi = {
  start: (body: {
    fullName: string; email: string; position: string; organisation: string;
    lang: string; wallet: string | null; turnstileToken: string;
  }) => call<StartResult>("/start", { method: "POST", body: JSON.stringify(body) }),

  verifyEmail: (body: { regId: string; code: string }) =>
    call<AttemptStart>("/verify-email", { method: "POST", body: JSON.stringify(body) }),

  answer: (body: { attemptId: string; index: number; answer: number }) =>
    call<AnswerResult>("/answer", { method: "POST", body: JSON.stringify(body) }),

  finish: (attemptId: string) =>
    call<FinishResult>("/finish", { method: "POST", body: JSON.stringify({ attemptId }) }),

  attempt: (attemptId: string) => call<AttemptStart & { answered: number; expired: boolean; submitted: boolean }>(`/attempt/${attemptId}`),

  verify: (serial: string) => call<VerifyResult>(`/verify/${encodeURIComponent(serial)}`),
};

// The sitting survives a refresh: only the attempt id is remembered, and the server is the one that
// knows where the sitting got to.
const LS_KEY = "educhain-cert-attempt";
export const rememberAttempt = (id: string) => { try { localStorage.setItem(LS_KEY, id); } catch { /* private mode */ } };
export const forgetAttempt = () => { try { localStorage.removeItem(LS_KEY); } catch { /* private mode */ } };
export const rememberedAttempt = (): string | null => { try { return localStorage.getItem(LS_KEY); } catch { return null; } };
