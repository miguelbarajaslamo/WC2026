"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BootstrapError,
  bootstrapQueryKey,
  fetchBootstrapData,
} from "@/lib/api/bootstrap";

export function useBootstrap() {
  return useQuery({
    queryFn: fetchBootstrapData,
    queryKey: bootstrapQueryKey,
    retry(failureCount, error) {
      // No point retrying when the user simply has no pool or is signed out.
      if (error instanceof BootstrapError && error.code) {
        return false;
      }

      return failureCount < 2;
    },
  });
}
