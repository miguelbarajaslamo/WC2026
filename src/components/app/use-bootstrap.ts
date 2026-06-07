"use client";

import { useQuery } from "@tanstack/react-query";
import { bootstrapQueryKey, fetchBootstrapData } from "@/lib/api/bootstrap";

export function useBootstrap() {
  return useQuery({
    queryFn: fetchBootstrapData,
    queryKey: bootstrapQueryKey,
  });
}
