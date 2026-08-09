export function sortFixturesForFplOrder<T>(
  fixtures: T[],
  getKickoffAt: (fixture: T) => string,
  getExternalFixtureId: (fixture: T) => number,
): T[] {
  return [...fixtures].sort((left, right) => {
    const kickoffDifference = Date.parse(getKickoffAt(left)) - Date.parse(getKickoffAt(right));
    return kickoffDifference || getExternalFixtureId(left) - getExternalFixtureId(right);
  });
}
