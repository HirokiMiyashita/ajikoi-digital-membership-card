import { RPCHandler } from "@orpc/server/fetch";

import { appRouter } from "@/orpc/router";

const rpcHandler = new RPCHandler(appRouter);

async function handle(request: Request): Promise<Response> {
  const { matched, response } = await rpcHandler.handle(request, {
    prefix: "/api/rpc",
    context: {
      request,
    },
  });

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
