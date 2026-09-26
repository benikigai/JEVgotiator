import { connectPhotonCredentials } from "@vercel/connect/eve";
import { AsyncLocalStorage } from "node:async_hooks";
import type { RouteHandlerArgs, Session } from "eve/channels";
import type { ChatSdkChannelState } from "eve/channels/chat-sdk";
import { defaultPhotonAuth, photonIMessageChannel } from "eve/channels/photon";

const webhookContext = new AsyncLocalStorage<RouteHandlerArgs<ChatSdkChannelState>>();
type ResettableSession = Pick<Session, "id" | "reset" | "getEventStream">;

export async function resetPhotonConversation(input: { text: string; sentAt: Date }, ops: {
  resolveSession(): Promise<ResettableSession | undefined>;
  reply(text: string): Promise<unknown>;
}) {
  if (!/^\/(?:reset|new)$/i.test(input.text.trim())) return false;
  const sentAt = input.sentAt.getTime();
  if (!Number.isFinite(sentAt)) {
    await ops.reply("I couldn't verify that reset command. Please send /reset again.");
    return true;
  }
  const session = await ops.resolveSession();
  if (session) {
    const reader = (await session.getEventStream({ startIndex: 0 })).getReader();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const first = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Reset session lookup timed out")), 5000); }),
      ]);
      const startedAt = first.done ? NaN : Date.parse(first.value.meta.at);
      if (!Number.isFinite(startedAt)) throw new Error("Session start could not be verified");
      // A replayed old command must never retire a session created after that command.
      if (sentAt <= startedAt) return true;
    } finally {
      clearTimeout(timer);
      await reader.cancel().catch(() => {});
    }
    // Pin the reset to the resolved ID, even if another request changes the thread owner.
    await session.reset({ reason: "Buyer requested a fresh Photon conversation" });
  }
  await ops.reply("Ready for a fresh search. Your previous conversation is saved. Send the Tesla you want and your budget to start again.");
  return true;
}

const channel = photonIMessageChannel({
  async credentials() {
    const connector = process.env.PHOTON_CONNECTOR_ID;
    if (connector) return connectPhotonCredentials(connector)();
    const projectId = process.env.IMESSAGE_PROJECT_ID;
    const projectSecret = process.env.IMESSAGE_PROJECT_SECRET;
    if (!projectId || !projectSecret) throw new Error("Photon project credentials are not configured.");
    return { projectId, projectSecret };
  },
  webhookSecret: process.env.IMESSAGE_WEBHOOK_SECRET,
  turnPolicy: "queue",
  async onMessage({ thread }, message) {
    if (/^\/(?:reset|new)$/i.test(message.text.trim())) {
      const route = webhookContext.getStore();
      if (!route) throw new Error("Photon reset requires a verified webhook context");
      await resetPhotonConversation({ text: message.text, sentAt: message.metadata.dateSent }, {
        resolveSession: () => route.resolveSession(thread.id),
        reply: (text) => thread.post({ markdown: text }),
      });
      return null;
    }
    return { auth: defaultPhotonAuth(message) };
  },
});

// Photon validates the signed request before onMessage runs. Keep its route operations request-scoped.
export default {
  ...channel,
  routes: channel.routes.map((route) => route.transport === "websocket" ? route : {
    ...route,
    handler: (request: Request, context: RouteHandlerArgs<ChatSdkChannelState>) => webhookContext.run(context, () => route.handler(request, context)),
  }),
};
