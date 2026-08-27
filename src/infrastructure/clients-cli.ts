import { openSqliteClientStore } from "./client-repository.js";

const [command, ...args] = process.argv.slice(2);
const store = openSqliteClientStore();
try {
  if (command === "create") {
    const name = requiredOption(args, "--name");
    const created = store.clients.create(name);
    console.log(
      JSON.stringify(
        {
          client_id: created.client.clientId,
          client_secret: created.clientSecret,
        },
        null,
        2,
      ),
    );
  } else if (command === "list") {
    console.log(JSON.stringify(store.clients.list(), null, 2));
  } else if (command === "rotate") {
    const clientId = requiredOption(args, "--client-id");
    const currentSecret = requiredOption(args, "--current-secret");
    const rotated = store.clients.rotate(clientId, currentSecret);
    if (!rotated)
      throw new Error(
        "Client not found, revoked, expired, or current secret invalid.",
      );
    console.log(
      JSON.stringify(
        {
          client_id: rotated.client.clientId,
          client_secret: rotated.clientSecret,
        },
        null,
        2,
      ),
    );
  } else if (command === "revoke") {
    const clientId = requiredOption(args, "--client-id");
    if (!store.clients.revoke(clientId))
      throw new Error("Active client not found.");
    console.log(JSON.stringify({ client_id: clientId, status: "revoked" }));
  } else {
    throw new Error(
      "Usage: pnpm clients:create -- --name <name> | clients:list | clients:rotate -- --client-id <id> --current-secret <secret> | clients:revoke -- --client-id <id>",
    );
  }
} finally {
  store.close();
}

function requiredOption(args: string[], option: string): string {
  const index = args.indexOf(option);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`Missing ${option}.`);
  return value;
}
