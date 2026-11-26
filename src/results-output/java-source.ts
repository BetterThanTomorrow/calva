import * as sessionRegistry from '../nrepl/session-registry';
import * as replSession from '../nrepl/repl-session';

/**
 * Finds the source file of a Java class's member with cider-nrepl's `info`, in the session that
 * reported the error. Resolves with a `file:` or `jar:file:` URL, or undefined when there is no
 * source, as for classes without a source jar.
 */
export async function javaSourceUrl(
  sessionKey: string | undefined,
  className: string,
  member: string
): Promise<string | undefined> {
  const session =
    (sessionKey && sessionRegistry.getSession(sessionKey)) || replSession.getSession();
  const info = await session?.javaMemberInfo(className, member);
  const fileUrl = info?.['file-url'];
  return typeof fileUrl === 'string' ? fileUrl : undefined;
}
