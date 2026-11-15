import { AdminController } from "../../apps/api/src/admin-controller.js";
import { StaffAccess } from "../../apps/api/src/staff.js";
import type { Database } from "../../apps/api/src/database.js";
import type { WalletService } from "../../apps/api/src/wallet.js";

test("staff access fails closed without an OIDC token", async () => {
  await expect(
    new StaffAccess({} as Database).authorize(undefined),
  ).rejects.toThrow();
});

test("catalog writes require write permission before accessing the database", async () => {
  let writePermission: boolean | undefined;
  const staff = {
    authorize: async (_header: unknown, write?: boolean) => {
      writePermission = write;
      throw new Error("denied");
    },
  } as unknown as StaffAccess;
  const controller = new AdminController(
    {} as Database,
    {} as WalletService,
    staff,
  );
  await expect(
    controller.change("Bearer viewer", {
      action: "product",
      code: "test",
      name: "Test",
    }),
  ).rejects.toThrow("denied");
  expect(writePermission).toBe(true);
});

test("JWT validation rejects untrusted claims and enforces staff roles", async () => {
  const { createServer } = await import("node:http");
  const { generateKeyPair, exportJWK, SignJWT } = await import("jose");
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ keys: [{ ...jwk, kid: "test", alg: "RS256" }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing server address");
  const previous = {
    issuer: process.env.STAFF_OIDC_ISSUER,
    audience: process.env.STAFF_OIDC_AUDIENCE,
    jwks: process.env.STAFF_OIDC_JWKS_URL,
  };
  process.env.STAFF_OIDC_ISSUER = "https://staff.example";
  process.env.STAFF_OIDC_AUDIENCE = "billing";
  process.env.STAFF_OIDC_JWKS_URL = `http://127.0.0.1:${address.port}`;
  let role = "viewer";
  const staff = new StaffAccess({
    identityBinding: {
      findUnique: async () => ({
        identityId: "staff",
        deletedAt: null,
        identity: { deletedAt: null },
      }),
    },
    staffRole: { findMany: async () => [{ role }] },
  } as unknown as Database);
  const sign = (audience: string) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setSubject("user")
      .setIssuer("https://staff.example")
      .setAudience(audience)
      .setExpirationTime("5m")
      .sign(privateKey);
  try {
    const token = `Bearer ${await sign("billing")}`;
    expect(await staff.authorize(token)).toBe("staff");
    await expect(staff.authorize(token, true)).rejects.toThrow();
    role = "admin";
    expect(await staff.authorize(token, true)).toBe("staff");
    await expect(
      staff.authorize(`Bearer ${await sign("other")}`),
    ).rejects.toThrow();
  } finally {
    for (const [key, value] of Object.entries({
      STAFF_OIDC_ISSUER: previous.issuer,
      STAFF_OIDC_AUDIENCE: previous.audience,
      STAFF_OIDC_JWKS_URL: previous.jwks,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("publication only transitions a draft and rejects past effective dates", async () => {
  const calls: unknown[] = [];
  const tx = {
    creditRateVersion: {
      updateMany: async (args: unknown) => {
        calls.push(args);
        return { count: 1 };
      },
    },
    adminAuditLog: { create: async () => ({}) },
  };
  const controller = new AdminController(
    {
      $transaction: async (fn: (value: unknown) => unknown) => fn(tx),
    } as unknown as Database,
    {} as WalletService,
    { authorize: async () => "staff" } as unknown as StaffAccess,
  );
  const id = "019a85e0-1111-7111-8111-111111111111";
  await controller.change("Bearer staff", {
    action: "publish",
    target: "rate",
    id,
    effectiveFrom: "2099-01-01T00:00:00Z",
  });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ where: { id, publishedAt: null } });
  await expect(
    controller.change("Bearer staff", {
      action: "publish",
      target: "rate",
      id,
      effectiveFrom: "2000-01-01T00:00:00Z",
    }),
  ).rejects.toThrow();
  expect(calls).toHaveLength(1);
});

test("dev-admin access authorizes in development when dev account is enabled and rejects in production", async () => {
  const upserted: unknown[] = [];
  const db = {
    identity: {
      upsert: async (args: unknown) => {
        upserted.push(args);
        return {};
      },
    },
    staffRole: {
      upsert: async (args: unknown) => {
        upserted.push(args);
        return {};
      },
    },
  } as unknown as Database;
  const staff = new StaffAccess(db);

  const prevDev = process.env.DEV_ACCOUNT_ENABLED;
  const prevEnv = process.env.NODE_ENV;

  try {
    process.env.DEV_ACCOUNT_ENABLED = "true";
    process.env.NODE_ENV = "development";

    const actor = await staff.authorize("Bearer dev-admin", true);
    expect(actor).toBe("0193a000-0000-7000-8000-000000000004");
    expect(upserted).toHaveLength(2);

    process.env.NODE_ENV = "production";
    await expect(staff.authorize("Bearer dev-admin", true)).rejects.toThrow();

    process.env.NODE_ENV = "development";
    process.env.DEV_ACCOUNT_ENABLED = "false";
    await expect(staff.authorize("Bearer dev-admin", true)).rejects.toThrow();
  } finally {
    if (prevDev === undefined) delete process.env.DEV_ACCOUNT_ENABLED;
    else process.env.DEV_ACCOUNT_ENABLED = prevDev;
    if (prevEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevEnv;
  }
});
