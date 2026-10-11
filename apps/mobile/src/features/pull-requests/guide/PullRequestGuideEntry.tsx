import { useNavigation } from "@react-navigation/native";
import { PullRequestCardGroup, PullRequestCardRow } from "../PullRequestControls";
import type { PullRequestParams } from "../usePullRequestDiff";
import { useReviewGuidesEnabled } from "./useReviewGuide";

export function PullRequestGuideEntry({ params }: { readonly params: PullRequestParams }) {
  const navigation = useNavigation();
  const enabled = useReviewGuidesEnabled(params);
  if (!enabled) return null;
  return (
    <PullRequestCardGroup>
      <PullRequestCardRow
        title="Guide"
        detail="A tour through this change"
        icon="sparkles"
        last
        onPress={() => navigation.navigate("PullRequestGuide", params)}
      />
    </PullRequestCardGroup>
  );
}
