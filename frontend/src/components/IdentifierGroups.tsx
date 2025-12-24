import type { Identifier, IdentifierType } from '../lib/types'

interface IdentifierGroupsProps {
  identifiers: Identifier[]
}

export function IdentifierGroups({ identifiers }: IdentifierGroupsProps) {
  // Group identifiers by type
  const grouped = identifiers.reduce(
    (acc, id) => {
      if (!acc[id.type]) {
        acc[id.type] = []
      }
      acc[id.type].push(id)
      return acc
    },
    {} as Record<IdentifierType, Identifier[]>,
  )

  const types = Object.keys(grouped).sort() as IdentifierType[]

  if (types.length === 0) {
    return (
      <div style={{ padding: 12, color: '#6b7280', fontStyle: 'italic' }}>
        No identifiers
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {types.map((type) => (
        <div key={type}>
          <h4
            style={{
              margin: 0,
              marginBottom: 8,
              fontSize: 14,
              fontWeight: 600,
              textTransform: 'capitalize',
              color: '#374151',
            }}
          >
            {type}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {grouped[type].map((id) => (
              <div
                key={id.id}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  fontSize: 13,
                  fontFamily: 'monospace',
                }}
              >
                {id.value}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
