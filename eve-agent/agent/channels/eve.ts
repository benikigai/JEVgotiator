import { eveChannel } from "eve/channels/eve";
import { createHash, timingSafeEqual } from "node:crypto";
import { localDev, type AuthFn, vercelOidc } from "eve/channels/auth";

const operatorKey: AuthFn<Request> = (request) => {
  const expected = process.env.EVE_API_KEY;
  const provided = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!expected || !provided || !timingSafeEqual(createHash("sha256").update(expected).digest(), createHash("sha256").update(provided).digest())) return null;
  return { authenticator: "jevgotiator-operator-key", principalId: "jevgotiator-operator", principalType: "app", attributes: {} };
};

export default eveChannel({
  auth: [
    operatorKey,
    vercelOidc(),
    localDev(),
  ],
});
