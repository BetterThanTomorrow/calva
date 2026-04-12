export interface ReplStartMatch {
  host: string;
  port: string;
  matchedText: string;
}

export interface BufferedReplStartDetection {
  buffer: string;
  match?: ReplStartMatch;
}

const replStartedPattern = /Started nREPL server|nREPL server started/i;
const replPortPattern =
  /(?:Started nREPL server|nREPL server started)[^\r\n]+?(?:(?:on port (\d+)(?: on host (\S+))?)|([^\s/]+):(\d+))|.*?(\d+) TODO/i;
const maxBufferedChars = 4096;

function trimBuffer(buffer: string): string {
  return buffer.length > maxBufferedChars ? buffer.slice(-maxBufferedChars) : buffer;
}

export function parseReplStart(output: string): ReplStartMatch | undefined {
  const trimmedOutput = output.trim();
  if (!replStartedPattern.test(trimmedOutput)) {
    return undefined;
  }

  const match = trimmedOutput.match(replPortPattern);
  if (!match) {
    return undefined;
  }

  const [, port1, host1, host2, port2, port3] = match;
  const port = port1 ?? port2 ?? port3;
  if (!port) {
    return undefined;
  }

  return {
    host: host1 ?? host2 ?? 'localhost',
    port,
    matchedText: match[0],
  };
}

export function detectBufferedReplStart(
  existingBuffer: string,
  chunk: string
): BufferedReplStartDetection {
  const combined = trimBuffer(`${existingBuffer}${chunk}`);
  const lines = combined.split(/\r?\n/);
  const incompleteTail = lines.pop() ?? '';

  for (const line of lines) {
    const match = parseReplStart(line);
    if (match) {
      return { buffer: '', match };
    }
  }

  return { buffer: trimBuffer(incompleteTail) };
}
