import { observer } from 'mobx-react-lite'
import { useEffect, useState } from 'react'
import { useRootStore } from '../stores/RootStore'
import { TableView, type Column } from '../components/TableView'
import type { Identifier } from '../lib/types'
import type { ReplicaRow } from '../lib/sync/types'

export const IdentifiersPage = observer(function IdentifiersPage() {
  const { replica } = useRootStore()
  const [identifiers, setIdentifiers] = useState<Array<ReplicaRow<Identifier>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await replica.listByUpdatedAt('identifiers', 1000)
        setIdentifiers(data)
      } catch (error) {
        console.error('Failed to load identifiers:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [replica])

  const columns: Array<Column<ReplicaRow<Identifier>>> = [
    {
      key: 'entity_id',
      label: 'Entity',
      width: '160px',
      render: (row) => (
        <span className="font-mono text-xs">
          {row.entity_id.slice(0, 8)}...
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: '140px',
      render: (row) => (
        <span className="capitalize font-medium">{row.type}</span>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      render: (row) => (
        <span className="font-mono text-[13px] font-medium">
          {row.value}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      width: '180px',
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
  ]

  return (
    <div>
      <div className="p-4 border-b border-gray-200">
        <h2 className="m-0 mb-4 text-xl font-bold">Identifiers</h2>
      </div>
      <TableView
        columns={columns}
        data={identifiers}
        loading={loading}
        emptyMessage="No identifiers found."
      />
    </div>
  )
})