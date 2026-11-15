import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Database } from "./database.js";

@Injectable()
export class StaffAccess {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;
  constructor(@Inject(Database) private readonly db: Database) {}
  async authorize(header: string | undefined, write = false) {
    const issuer = process.env.STAFF_OIDC_ISSUER;
    const audience = process.env.STAFF_OIDC_AUDIENCE;
    const url = process.env.STAFF_OIDC_JWKS_URL;
    if (!issuer || !audience || !url || !header?.startsWith("Bearer "))
      throw new UnauthorizedException({ code: "STAFF_AUTH_REQUIRED" });
    let subject: string;
    try {
      this.jwks ??= createRemoteJWKSet(new URL(url));
      const { payload } = await jwtVerify(header.slice(7), this.jwks, {
        issuer,
        audience,
        algorithms: ["RS256", "ES256"],
        requiredClaims: ["sub", "exp"],
      });
      subject = payload.sub!;
    } catch {
      throw new UnauthorizedException({ code: "STAFF_AUTH_REQUIRED" });
    }
    const binding = await this.db.identityBinding.findUnique({
      where: { issuer_subject: { issuer, subject } },
      include: { identity: true },
    });
    if (!binding || binding.deletedAt || binding.identity.deletedAt)
      throw new ForbiddenException({ code: "STAFF_ACCESS_DENIED" });
    const roles = await this.db.staffRole.findMany({
      where: { identityId: binding.identityId },
    });
    if (
      !roles.some(({ role }) =>
        write ? role === "owner" || role === "admin" : true,
      )
    )
      throw new ForbiddenException({ code: "STAFF_ACCESS_DENIED" });
    return binding.identityId;
  }
}
