import { requireEnv } from "@/lib/env";

const apiFootballBaseUrl = "https://v3.football.api-sports.io";

export type ApiFootballFixtureQuery = {
  ids?: number[];
  live?: "all";
  league?: number;
  season?: number;
};

export async function apiFootballRequest<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${apiFootballBaseUrl}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": requireEnv("apiFootballKey"),
    },
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed: ${response.status}`);
  }

  return response.json();
}

export function fixtureQueryParams(query: ApiFootballFixtureQuery) {
  return {
    ids: query.ids?.join("-"),
    league: query.league,
    live: query.live,
    season: query.season,
  };
}
