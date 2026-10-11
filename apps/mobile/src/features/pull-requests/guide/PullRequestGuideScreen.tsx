import { parsePatchFiles } from "@pierre/diffs/utils/parsePatchFiles";
import type { FileDiffMetadata } from "@pierre/diffs";
import { StackActions, useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { useEffect, useMemo } from "react";
import { Platform, View } from "react-native";
import { AndroidScreenHeader } from "../../../components/AndroidScreenHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  letterStopNotes,
  stepTourPosition,
  stopFilePaths,
  stopSubline,
} from "@t3tools/client-runtime/review-guide-tour";
import { AppText as Text } from "../../../components/AppText";
import { MaterialButton } from "../../../components/MaterialButton";
import { ScreenScrollView } from "../../../components/ScreenScrollView";
import { NativeStackScreenOptions } from "../../../native/StackHeader";
import { PullRequestCardGroup, PullRequestCardRow } from "../PullRequestControls";
import { PullRequestMarkdown, PullRequestMarkdownRepository } from "../PullRequestMarkdown";
import { usePullRequestDiff, type PullRequestParams } from "../usePullRequestDiff";
import { ReviewGuideExcerpt } from "./ReviewGuideExcerpt";
import { reviewGuideState } from "./reviewGuideState";
import { useReviewGuide } from "./useReviewGuide";

export type GuideStopParams = PullRequestParams & {
  readonly position: number;
  readonly guideHeadSha: string;
  readonly guideGeneratedAt: string;
};

function GuideNotice({ state }: { readonly state: ReturnType<typeof useReviewGuide> }) {
  const { guide, stale, failure } = reviewGuideState(state.data);
  const error = state.startError ?? failure ?? state.error;
  const label = state.running
    ? guide
      ? "Rewriting review guide"
      : "Writing review guide"
    : error
      ? "Could not write guide"
      : stale
        ? "Guide is out of date"
        : "No review guide yet";
  if (guide && !stale && !error && !state.running) return null;
  return (
    <View className="gap-3 rounded-2xl bg-grouped-card p-4" accessibilityLiveRegion="polite">
      <Text className="text-base font-t3-semibold">{label}</Text>
      <Text className="text-sm text-foreground-muted">
        {error ??
          (state.running
            ? "An agent is reading the change. Large pull requests can take a few minutes. You can leave and return while it works."
            : stale
              ? "This guide was written before the latest push. Its excerpts may no longer match the current change."
              : "A tour through the change, with the code worth reading and the calls for you to make.")}
      </Text>
      {state.running ? (
        <Text className="text-xs text-foreground-muted">
          {state.data?.run?._tag === "Running"
            ? `Started ${new Date(state.data.run.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · waiting for the guide`
            : "Starting the guide…"}
        </Text>
      ) : state.canWrite ? (
        <MaterialButton
          label={error ? "Try again" : guide ? "Rewrite guide" : "Write guide"}
          onPress={() => void state.write()}
        />
      ) : null}
    </View>
  );
}

export function PullRequestGuideScreen({ route }: StaticScreenProps<PullRequestParams>) {
  const navigation = useNavigation();
  const state = useReviewGuide(route.params);
  const { guide, stale } = reviewGuideState(state.data);
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-screen">
      <NativeStackScreenOptions options={{ title: "Review guide", headerTitle: "Review guide" }} />
      {Platform.OS === "android" ? (
        <AndroidScreenHeader title="Review guide" onBack={() => navigation.goBack()} />
      ) : null}
      <ScreenScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 20 }}
      >
        {!state.enabled ? (
          <Text>Review guides are disabled for this server.</Text>
        ) : (
          <>
            {state.isPending && !state.data ? (
              <Text className="text-foreground-muted">Loading review guide…</Text>
            ) : (
              <GuideNotice state={state} />
            )}
            {guide ? (
              <>
                <Text className="text-xs text-foreground-muted">
                  {guide.stops.length} stops · read in order
                </Text>
                <PullRequestCardGroup>
                  {guide.stops.map((stop, position) => (
                    <PullRequestCardRow
                      key={`${guide.headSha}:${JSON.stringify(stop)}`}
                      title={`${position + 1}. ${stop.title}`}
                      detail={stopSubline(stop)}
                      icon={stop.attention ? "eye" : "text.alignleft"}
                      last={position === guide.stops.length - 1}
                      onPress={() =>
                        navigation.dispatch(
                          StackActions.push("PullRequestGuideStop", {
                            ...route.params,
                            position,
                            guideHeadSha: guide.headSha,
                            guideGeneratedAt: guide.generatedAt,
                          }),
                        )
                      }
                    />
                  ))}
                </PullRequestCardGroup>
                {state.canWrite && !state.running && !stale && !state.startError && !state.error ? (
                  <MaterialButton label="Rewrite guide" onPress={() => void state.write()} />
                ) : null}
              </>
            ) : null}
          </>
        )}
      </ScreenScrollView>
    </View>
  );
}

export function PullRequestGuideStopScreen({ route }: StaticScreenProps<GuideStopParams>) {
  const navigation = useNavigation();
  const state = useReviewGuide(route.params);
  const { guide, stale } = reviewGuideState(state.data);
  const position = Math.max(0, Math.min(route.params.position, (guide?.stops.length ?? 1) - 1));
  const stop = guide?.stops[Math.max(0, position)];
  const diff = usePullRequestDiff(route.params);
  const excerptFiles = useMemo(() => {
    const files = new Map<string, FileDiffMetadata>();
    try {
      for (const patch of parsePatchFiles(diff.patch)) {
        for (const file of patch.files) {
          files.set(file.name, file);
          if (file.prevName) files.set(file.prevName, file);
        }
      }
    } catch {
      // An omitted or unparseable patch is shown as unavailable by the excerpt.
    }
    return files;
  }, [diff.patch]);
  const wanted = useMemo(() => (stop ? stopFilePaths(stop) : []), [stop]);
  const loadedPaths = new Set(
    diff.parsed.kind === "files" ? diff.parsed.files.map((file) => file.path) : [],
  );
  const missing = wanted.some((path) => !loadedPaths.has(path));
  const { error: diffError, loadMore } = diff;
  useEffect(() => {
    if (state.enabled && missing && !diffError) loadMore();
  }, [state.enabled, missing, diffError, loadMore]);
  const insets = useSafeAreaInsets();
  const changedGuide =
    guide !== null &&
    (guide.headSha !== route.params.guideHeadSha ||
      guide.generatedAt !== route.params.guideGeneratedAt);
  const notes = stop ? letterStopNotes(stop).lettered : [];
  return (
    <View className="flex-1 bg-screen">
      <NativeStackScreenOptions
        options={{
          title: `Stop ${route.params.position + 1}`,
          headerTitle: `Stop ${route.params.position + 1} of ${guide?.stops.length ?? "…"}`,
        }}
      />
      {Platform.OS === "android" ? (
        <AndroidScreenHeader
          title={`Stop ${route.params.position + 1}`}
          onBack={() => navigation.goBack()}
        />
      ) : null}
      <PullRequestMarkdownRepository
        value={`https://${route.params.host ?? "github.com"}/${route.params.repository}`}
      >
        <ScreenScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 20 }}
        >
          {!state.enabled ? (
            <Text>Review guides are disabled for this server.</Text>
          ) : changedGuide ? (
            <Text>This guide was rewritten. Go back to start the new tour.</Text>
          ) : !stop ? (
            <Text>{state.error ?? "Loading stop…"}</Text>
          ) : (
            <>
              <GuideNotice state={state} />
              <Text className="text-2xl font-t3-semibold">{stop.title}</Text>
              <PullRequestMarkdown markdown={stop.summary} />
              {stop.attention ? (
                <View className="gap-2 rounded-2xl bg-grouped-card p-4">
                  <Text className="font-t3-semibold">Look closely · {stop.attention.kind}</Text>
                  <PullRequestMarkdown markdown={stop.attention.note} />
                </View>
              ) : null}
              {stale ? (
                <Text className="text-sm text-foreground-muted">
                  Excerpts are hidden until the guide is rewritten for the current head.
                </Text>
              ) : (
                stop.excerpts.map((excerpt) => (
                  <ReviewGuideExcerpt
                    key={`${guide?.headSha}:${JSON.stringify(excerpt)}`}
                    excerpt={excerpt}
                    file={excerptFiles.get(excerpt.path)}
                    loading={diff.isPending || (missing && diff.nextCursor !== null)}
                  />
                ))
              )}
              {diff.error ? <Text className="text-danger-foreground">{diff.error}</Text> : null}
              {notes.length ? (
                <View className="gap-4">
                  <Text className="font-t3-semibold">Notes on this stop</Text>
                  {notes.map(({ marker, note }) => (
                    <View key={marker} className="gap-2 rounded-2xl bg-grouped-card p-4">
                      <Text className="font-t3-semibold">
                        {marker} · {note.title}
                      </Text>
                      <Text className="font-mono text-xs text-foreground-muted">
                        {note.path}:{note.line}
                      </Text>
                      <PullRequestMarkdown markdown={note.body} />
                    </View>
                  ))}
                </View>
              ) : null}
              {stop.files.length ? (
                <PullRequestCardGroup>
                  {stop.files.map((file, index) => (
                    <PullRequestCardRow
                      key={file.path}
                      title={file.path}
                      detail={file.note}
                      icon="doc"
                      last={index === stop.files.length - 1}
                      onPress={() =>
                        navigation.navigate("PullRequestFile", { ...route.params, path: file.path })
                      }
                    />
                  ))}
                </PullRequestCardGroup>
              ) : null}
              {stop.questions.length ? (
                <View className="gap-3">
                  <Text className="font-t3-semibold">Questions to consider</Text>
                  {stop.questions.map((question) => (
                    <PullRequestMarkdown key={question} markdown={question} />
                  ))}
                </View>
              ) : null}
              {guide && route.params.position < guide.stops.length - 1 ? (
                <MaterialButton
                  label={`Next: ${guide.stops[route.params.position + 1]?.title}`}
                  onPress={() =>
                    navigation.dispatch(
                      StackActions.push("PullRequestGuideStop", {
                        ...route.params,
                        position: stepTourPosition(route.params.position, 1, guide.stops.length),
                      }),
                    )
                  }
                />
              ) : (
                <MaterialButton
                  label="Finish tour"
                  onPress={() => navigation.navigate("PullRequestGuide", route.params)}
                />
              )}
            </>
          )}
        </ScreenScrollView>
      </PullRequestMarkdownRepository>
    </View>
  );
}
