import { observer } from 'mobx-react-lite'
import type { EntityResolution, ClarificationRequest } from '../services/llm/types'

interface ResolutionReviewProps {
  resolutions?: EntityResolution[]
  clarifications?: ClarificationRequest[]
}

export const ResolutionReview = observer(function ResolutionReview({ resolutions, clarifications }: ResolutionReviewProps) {
  if ((!resolutions || resolutions.length === 0) && (!clarifications || clarifications.length === 0)) {
    return null
  }

  return (
    <div className="mb-6 space-y-4">
      {/* Clarification Requests */}
      {clarifications && clarifications.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-amber-800 mb-3">Clarification Needed</h3>
          <div className="space-y-3">
            {clarifications.map((req, idx) => (
              <div key={idx} className="bg-white p-3 rounded border border-amber-100">
                <p className="font-medium text-gray-900 mb-2">{req.question}</p>
                <div className="text-sm text-gray-600 mb-2 italic">"{req.context}"</div>
                {req.options && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {req.options.map((opt, optIdx) => (
                      <span key={optIdx} className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full">
                        {opt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entity Resolutions */}
      {resolutions && resolutions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-800 mb-3">Entity Resolution Analysis</h3>
          <div className="space-y-3">
            {resolutions.map((res, idx) => (
              <div key={idx} className="bg-white p-3 rounded border border-blue-100">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold text-gray-900">{res.entity_ref}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      res.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                      res.status === 'ambiguous' ? 'bg-amber-100 text-amber-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {res.status}
                    </span>
                  </div>
                </div>
                
                {res.reasoning && (
                  <p className="text-sm text-gray-600 mb-3">{res.reasoning}</p>
                )}

                {res.candidates && res.candidates.length > 0 && (
                  <div className="mt-2 border-t border-gray-100 pt-2">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Candidates:</p>
                    <div className="space-y-2">
                      {res.candidates.map((cand, cIdx) => (
                        <div key={cIdx} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                          <div>
                            <span className="font-medium">{cand.name}</span>
                            <span className="text-xs text-gray-500 ml-2">({cand.type})</span>
                            <div className="text-xs text-gray-500 mt-0.5">{cand.reasoning}</div>
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
          </div>
        </div>
      )}
    </div>
  )
})
