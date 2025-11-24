import type { SessionKeyStatus } from '../nrepl/session-registry';

export class ConflictingSessionsError extends Error {
  public readonly conflicts: SessionKeyStatus[];
  public readonly docSlug: string;

  constructor(
    message: string,
    conflicts: SessionKeyStatus[],
    docSlug: string = 'connect/#multi-session-conflicts'
  ) {
    super(message);
    this.name = 'ConflictingSessionsError';
    this.conflicts = conflicts;
    this.docSlug = docSlug;
  }
}
