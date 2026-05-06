import { RPCHandler } from "@orpc/server/fetch";

import { appRouter } from "@/orpc/router";

const rpcHandler = new RPCHandler(appRouter);

async function handle(request: Request): Promise<Response> {
  const startedAt = Date.now();
  const { matched, response } = await rpcHandler.handle(request, {
    prefix: "/api/rpc",
    context: {
      request,
    },
  });
  const elapsedMs = Date.now() - startedAt;
  if (matched && elapsedMs >= 500) {
    console.info(`[rpc] ${request.method} ${new URL(request.url).pathname} ${elapsedMs}ms`);
  }

  if (matched) {
    return response;
  }

  return new Response("Not Found", { status: 404 });
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as OPTIONS,
};
