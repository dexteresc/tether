/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import { useApi } from "./use-api";

interface UseApiQueryOptions {
  enabled?: boolean;
  refetchInterval?: number | null;
}

interface UseApiQueryResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => Promise<T>;
  reset: () => void;
}

export function useApiQuery<T = any>(
  apiFunction: (...args: any[]) => Promise<T>,
  params: any[] = [],
  options: UseApiQueryOptions = {}
): UseApiQueryResult<T> {
  const { enabled = true, refetchInterval = null } = options;
  const { data, error, loading, execute, reset } = useApi(apiFunction);
  const paramsRef = useRef(params);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const paramsChanged =
      JSON.stringify(params) !== JSON.stringify(paramsRef.current);
    if (paramsChanged) {
      paramsRef.current = params;
    }

    execute(...params);

    if (refetchInterval) {
      intervalRef.current = setInterval(() => {
        execute(...params);
      }, refetchInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, execute, params, refetchInterval]);

  return {
    data,
    error,
    loading,
    refetch: () => execute(...params),
    reset,
  };
}
