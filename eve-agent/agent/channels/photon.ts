import { connectPhotonCredentials } from "@vercel/connect/eve";
import { photonIMessageChannel } from "eve/channels/photon";

export default photonIMessageChannel({
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
});
