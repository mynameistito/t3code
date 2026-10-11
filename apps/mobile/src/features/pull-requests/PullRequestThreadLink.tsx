import type { PullRequestDetail } from "@t3tools/contracts";
import { ControlPillMenu } from "../../components/ControlPillMenu";
import { PullRequestCardRow } from "./PullRequestControls";
import type { PullRequestParams } from "./usePullRequestDiff";
import { usePullRequestThreads } from "./usePullRequestThreads";

export function PullRequestThreadLink(props: {
  readonly pr: PullRequestDetail;
  readonly params: PullRequestParams;
}) {
  const links = usePullRequestThreads(props.params, props.pr);
  const thread = links.threads[0];
  if (links.isPending && !thread) return null;
  if (!thread)
    return (
      <PullRequestCardRow
        title="Ask about this PR"
        icon="sparkles"
        detail={
          links.error
            ? "Couldn't load linked threads. Start a new thread."
            : "Start a thread with the PR attached"
        }
        onPress={links.canAsk ? () => void links.ask() : undefined}
        last
      />
    );
  const row = (
    <PullRequestCardRow
      title={thread.title}
      icon="bubble.left.and.bubble.right"
      detail={thread.archivedAt ? "Archived thread" : "Linked thread"}
      value={links.threads.length > 1 ? `${links.threads.length} threads` : undefined}
      onPress={links.threads.length === 1 ? () => links.openThread(thread) : undefined}
      menu={links.threads.length > 1}
      last
    />
  );
  if (links.threads.length === 1) return row;
  return (
    <ControlPillMenu
      title="Linked threads"
      actions={links.threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        subtitle: thread.archivedAt ? "Archived" : undefined,
        image: "bubble.left.and.bubble.right",
      }))}
      onPressAction={({ nativeEvent }) => {
        const selected = links.threads.find((thread) => thread.id === nativeEvent.event);
        if (selected) links.openThread(selected);
      }}
    >
      {row}
    </ControlPillMenu>
  );
}
