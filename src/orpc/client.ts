import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";

import { appRouter } from "./router";

type AppRouterClient = RouterClient<typeof appRouter>;

let liffIdToken: string | null = null;

export function setRpcLiffIdToken(token: string | null) {
  liffIdToken = token;
}

const rpcLink = new RPCLink({
  url: () => {
    if (typeof window !== "undefined") {
      return new URL("/api/rpc", window.location.origin);
    }

    return new URL("http://localhost:3000/api/rpc");
  },
  fetch: async (request, init) => {
    if (!liffIdToken) {
      return fetch(request, init);
    }
    const headers = new Headers(request.headers);
    headers.set("authorization", `Bearer ${liffIdToken}`);
    return fetch(new Request(request, { headers }), init);
  },
});

export const rpcClient: AppRouterClient =
  createORPCClient<AppRouterClient>(rpcLink);
