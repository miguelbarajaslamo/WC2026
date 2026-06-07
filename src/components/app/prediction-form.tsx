import { InlinePredictionPicker } from "@/components/app/inline-prediction-picker";
import type { BootstrapData, Match } from "@/lib/types";

export function PredictionForm({
  data,
  match,
}: {
  data: BootstrapData;
  match: Match;
}) {
  return <InlinePredictionPicker data={data} match={match} />;
}
