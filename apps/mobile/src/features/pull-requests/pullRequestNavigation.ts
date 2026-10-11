import { parseChangeRequestUrl } from "@t3tools/shared/changeRequestUrl";
import type { PullRequestParams } from "./usePullRequestDiff";

export function nativePullRequestDestination(
  url: string,
  context: { environmentId: string; projectId: string } | null,
): PullRequestParams | null {
  const parsed = parseChangeRequestUrl(url);
  if (!parsed || !context) return null;
  return {
    ...context,
    repository: parsed.repository,
    number: parsed.number,
    host: parsed.authority ?? parsed.host,
  };
}
