import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openSqliteClientStore } from "../src/infrastructure/client-repository.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("SQLite client repository", () => {
  it("creates, authenticates, rotates, and revokes a client", () => {
    const directory = mkdtempSync(join(tmpdir(), "cybersarah-client-"));
    directories.push(directory);
    const store = openSqliteClientStore(join(directory, "clients.sqlite"));
    try {
      const created = store.clients.create("Integration client");
      expect(
        store.clients.authenticate(
          created.client.clientId,
          created.clientSecret,
        )?.clientId,
      ).toBe(created.client.clientId);
      const rotated = store.clients.rotate(
        created.client.clientId,
        created.clientSecret,
      );
      expect(rotated).toBeDefined();
      expect(
        store.clients.authenticate(
          created.client.clientId,
          created.clientSecret,
        ),
      ).toBeUndefined();
      expect(
        store.clients.authenticate(
          created.client.clientId,
          rotated!.clientSecret,
        )?.clientId,
      ).toBe(created.client.clientId);
      expect(store.clients.revoke(created.client.clientId)).toBe(true);
      expect(
        store.clients.authenticate(
          created.client.clientId,
          rotated!.clientSecret,
        ),
      ).toBeUndefined();
      expect(store.clients.findActive(created.client.clientId)).toBeUndefined();
    } finally {
      store.close();
    }
  });
});
