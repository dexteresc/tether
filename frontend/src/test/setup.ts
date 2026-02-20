import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'

async function resetIndexedDb(): Promise<void> {
  if (typeof indexedDB.databases !== 'function') return

  const databases = await indexedDB.databases()
  await Promise.all(
    databases
      .map((db) => db.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0)
      .map(
        (name) =>
          new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase(name)
            req.onsuccess = () => resolve()
            req.onerror = () => resolve()
            req.onblocked = () => resolve()
          }),
      ),
  )
}

afterEach(async () => {
  // Clear storage safely
  if (typeof localStorage !== 'undefined' && localStorage.clear) {
    localStorage.clear()
  }
  if (typeof sessionStorage !== 'undefined' && sessionStorage.clear) {
    sessionStorage.clear()
  }
  await resetIndexedDb()
})

