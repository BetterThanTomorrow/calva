export function filterCommentTokens(data: Uint32Array) {
  const filteredData: number[] = [];
  let accumulatedDeltaLine = 0;

  for (let i = 0; i < data.length; i += 5) {
    const [deltaLine, deltaStart, length, tokenType, modifiers] = Array.from(data.slice(i, i + 5));

    if (tokenType === 10) {
      // Just accumulate the delta for comment tokens
      accumulatedDeltaLine += deltaLine;
      continue;
    }

    if (filteredData.length === 0) {
      // First non-comment token keeps its original position
      filteredData.push(deltaLine, deltaStart, length, tokenType, modifiers);
    } else {
      // Subsequent tokens get their delta plus accumulated comment deltas
      filteredData.push(deltaLine + accumulatedDeltaLine, deltaStart, length, tokenType, modifiers);
    }
    // Reset accumulator after using it
    accumulatedDeltaLine = 0;
  }

  return filteredData;
}
