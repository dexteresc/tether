import { observer } from "mobx-react-lite";
import type {
  EntityResolution,
  ClarificationRequest,
} from "@/services/llm/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ResolutionReviewProps {
  resolutions?: EntityResolution[];
  clarifications?: ClarificationRequest[];
}

export const ResolutionReview = observer(function ResolutionReview({
  resolutions,
  clarifications,
}: ResolutionReviewProps) {
  if (
    (!resolutions || resolutions.length === 0) &&
    (!clarifications || clarifications.length === 0)
  ) {
    return null;
  }

  return (
    <div className="mb-6 space-y-4">
      {clarifications && clarifications.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-lg text-amber-800">
              Clarification Needed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {clarifications.map((req, idx) => (
              <div
                key={idx}
                className="bg-background p-3 rounded-md border border-amber-100"
              >
                <p className="font-medium mb-2">{req.question}</p>
                <div className="text-sm text-muted-foreground mb-2 italic">
                  &ldquo;{req.context}&rdquo;
                </div>
                {req.options && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {req.options.map((opt, optIdx) => (
                      <span
                        key={optIdx}
                        className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full"
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {resolutions && resolutions.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg text-blue-800">
              Entity Resolution Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resolutions.map((res, idx) => (
              <div
                key={idx}
                className="bg-background p-3 rounded-md border border-blue-100"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold">{res.entity_ref}</span>
                    <span
                      className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                        res.status === "resolved"
                          ? "bg-emerald-100 text-emerald-800"
                          : res.status === "ambiguous"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {res.status}
                    </span>
                  </div>
                </div>

                {res.reasoning && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {res.reasoning}
                  </p>
                )}

                {res.candidates && res.candidates.length > 0 && (
                  <div className="mt-2 border-t pt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      Candidates:
                    </p>
                    <div className="space-y-2">
                      {res.candidates.map((cand, cIdx) => (
                        <div
                          key={cIdx}
                          className="flex justify-between items-center p-2 bg-muted rounded text-sm"
                        >
                          <div>
                            <span className="font-medium">
                              {cand.name}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({cand.type})
                            </span>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {cand.reasoning}
                            </div>
                          </div>
                          <div className="font-semibold text-blue-600">
                            {Math.round(cand.match_score * 100)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
});
