import { AppError } from "../../shared/errors.js";

export type UserId = string;

export interface AuthenticatedUser {
  readonly id: UserId;
  readonly role: "user" | "moderator" | "admin";
}

export interface IdentityContext {
  requireUser(): AuthenticatedUser;
}

export class StaticIdentityContext implements IdentityContext {
  constructor(private readonly user?: AuthenticatedUser) {}

  requireUser(): AuthenticatedUser {
    if (!this.user) {
      throw new AppError("UNAUTHORIZED", "Authentication is required.");
    }
    return this.user;
  }
}
