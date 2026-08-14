import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";

const PLACES_BASE_URL = "https://places.googleapis.com/v1";
const REQUEST_TIMEOUT_MS = 5000;

type GooglePlacePrediction = {
  placeId?: string;
  text?: { text?: string };
};

type GoogleAutocompleteResponse = {
  suggestions?: Array<{ placePrediction?: GooglePlacePrediction }>;
};

type GooglePlaceDetailsResponse = {
  id?: string;
  formattedAddress?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
};

const getPlacesApiKey = (): string | null => {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  return key || null;
};

const fetchGooglePlaces = async (
  url: string,
  options: RequestInit,
  fieldMask: string
): Promise<globalThis.Response> => {
  const apiKey = getPlacesApiKey();
  if (!apiKey) {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
};

const parseGoogleResponse = async <T>(response: globalThis.Response): Promise<T> => {
  if (!response.ok) {
    const responseBody = await response.text();
    console.error("[PLACES] Google request failed", {
      status: response.status,
      body: responseBody.slice(0, 500),
    });
    throw new Error("Google Places request failed");
  }

  return (await response.json()) as T;
};

exports.autocompletePlaces = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const input = String(req.query.input || "").trim();
  const sessionToken = String(req.query.sessionToken || "").trim();

  if (input.length < 2 || input.length > 200) {
    res.status(400).json({ message: "input must contain between 2 and 200 characters" });
    return;
  }

  if (!sessionToken || sessionToken.length > 200) {
    res.status(400).json({ message: "sessionToken is required" });
    return;
  }

  try {
    const googleResponse = await fetchGooglePlaces(
      `${PLACES_BASE_URL}/places:autocomplete`,
      {
        method: "POST",
        body: JSON.stringify({
          input,
          includedRegionCodes: ["LK"],
          sessionToken,
        }),
      },
      "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text"
    );
    const data = await parseGoogleResponse<GoogleAutocompleteResponse>(googleResponse);
    const predictions = (data.suggestions || [])
      .map((suggestion) => suggestion.placePrediction)
      .filter((prediction): prediction is GooglePlacePrediction => Boolean(prediction?.placeId && prediction.text?.text))
      .map((prediction) => ({
        placeId: prediction.placeId as string,
        description: prediction.text?.text as string,
      }));

    res.json({ predictions });
  } catch (error: any) {
    const timedOut = error?.name === "AbortError";
    console.error("[PLACES] Autocomplete error:", error?.message || error);
    res.status(timedOut ? 504 : 502).json({
      message: timedOut ? "Location search timed out" : "Location search is temporarily unavailable",
    });
  }
});

exports.getPlaceDetails = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const placeId = String(req.query.placeId || "").trim();
  const sessionToken = String(req.query.sessionToken || "").trim();

  if (!placeId || placeId.length > 500) {
    res.status(400).json({ message: "placeId is required" });
    return;
  }

  if (!sessionToken || sessionToken.length > 200) {
    res.status(400).json({ message: "sessionToken is required" });
    return;
  }

  try {
    const query = new URLSearchParams({ sessionToken });
    const googleResponse = await fetchGooglePlaces(
      `${PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}?${query.toString()}`,
      { method: "GET" },
      "id,displayName,formattedAddress,location"
    );
    const place = await parseGoogleResponse<GooglePlaceDetailsResponse>(googleResponse);
    const latitude = Number(place.location?.latitude);
    const longitude = Number(place.location?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      res.status(502).json({ message: "Google Places returned an invalid location" });
      return;
    }

    res.json({
      placeId: place.id || placeId,
      description: place.formattedAddress || place.displayName?.text || "Selected location",
      latitude,
      longitude,
    });
  } catch (error: any) {
    const timedOut = error?.name === "AbortError";
    console.error("[PLACES] Details error:", error?.message || error);
    res.status(timedOut ? 504 : 502).json({
      message: timedOut ? "Location details timed out" : "Location details are temporarily unavailable",
    });
  }
});
