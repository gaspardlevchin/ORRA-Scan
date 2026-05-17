import type { GeoPoint, MapCenter } from "@/types/map";

type ElevationApiResponse = {
  elevation?: number[];
};

export async function getOpenElevation(
  point: GeoPoint | MapCenter,
  signal?: AbortSignal,
): Promise<number | null> {
  const url = new URL("https://api.open-meteo.com/v1/elevation");
  url.searchParams.set("latitude", String(point.latitude));
  url.searchParams.set("longitude", String(point.longitude));

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error("Open elevation request failed");
  }

  const data = (await response.json()) as ElevationApiResponse;
  const elevation = data.elevation?.[0];

  return typeof elevation === "number" ? elevation : null;
}
