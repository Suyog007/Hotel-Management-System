// Shared fakes for the Next.js request-scoped APIs ("use server" actions call
// redirect()/cookies()/revalidatePath() outside any real request, so they must
// be swapped out before the action module is imported).
export class RedirectSignal extends Error {
  url: string;
  constructor(url: string) {
    super(`REDIRECT:${url}`);
    this.url = url;
  }
}

export function makeRedirect() {
  return (url: string): never => {
    throw new RedirectSignal(url);
  };
}

export async function expectRedirectTo(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof RedirectSignal) return err.url;
    throw err;
  }
  throw new Error("expected a redirect, but the function returned normally");
}

export function makeCookieJar(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get: (name: string) => (store.has(name) ? { name, value: store.get(name) as string } : undefined),
    getAll: () => Array.from(store, ([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      store.set(name, value);
    },
    delete: (name: string) => {
      store.delete(name);
    },
    __store: store,
  };
}
