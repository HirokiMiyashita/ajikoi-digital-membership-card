import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";

import { appRouter } from "./router";

type AppRouterClient = RouterClient<typeof appRouter>;

const rpcLink = new RPCLink({
  url: () => {
    if (typeof window !== "undefined") {
      return new URL("/api/rpc", window.location.origin);
    }

    return new URL("http://localhost:3000/api/rpc");
  },
});

export const rpcClient: AppRouterClient =
  createORPCClient<AppRouterClient>(rpcLink);
