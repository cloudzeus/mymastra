import type {
  IntegrationConnection,
} from "../types";


export type GeoPoint = {
  latitude: number;
  longitude: number;
};


export type GeocodedPlace = {
  id?: string;

  name?: string;

  placeName?: string;

  point:
    GeoPoint;

  country?: string;
  countryCode?: string;

  raw:
    Record<string, unknown>;
};


type MapTilerFeature = {
  id?: string;

  text?: string;

  place_name?: string;

  center?: [
    number,
    number,
  ];

  geometry?: {
    coordinates?: [
      number,
      number,
    ];
  };

  properties?:
    Record<string, unknown>;

  context?: Array<{
    id?: string;
    text?: string;
    short_code?: string;
  }>;
};


type MapTilerGeocodingResponse = {
  features?:
    MapTilerFeature[];
};


function requireString(
  value: unknown,
  name: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `MapTiler connection ${name} is required`,
    );
  }

  return value.trim();
}


function extractPoint(
  feature:
    MapTilerFeature,
): GeoPoint | undefined {
  const coordinates =
    feature.center ??
    feature.geometry?.coordinates;


  if (
    !coordinates ||
    coordinates.length < 2
  ) {
    return undefined;
  }


  const [
    longitude,
    latitude,
  ] =
    coordinates;


  if (
    typeof longitude !== "number" ||
    typeof latitude !== "number"
  ) {
    return undefined;
  }


  return {
    latitude,
    longitude,
  };
}


function mapFeature(
  feature:
    MapTilerFeature,
): GeocodedPlace | undefined {
  const point =
    extractPoint(
      feature,
    );


  if (!point) {
    return undefined;
  }


  const countryContext =
    feature.context?.find(
      item =>
        item.id?.startsWith(
          "country.",
        ),
    );


  return {
    id:
      feature.id,

    name:
      feature.text,

    placeName:
      feature.place_name,

    point,

    country:
      countryContext?.text,

    countryCode:
      countryContext
        ?.short_code
        ?.replace(
          /^.*-/,
          "",
        )
        .toUpperCase(),

    raw:
      feature as unknown as
        Record<string, unknown>,
  };
}


export class MapTilerAdapter {
  private readonly baseUrl =
    "https://api.maptiler.com";


  constructor(
    private readonly connection:
      IntegrationConnection,
  ) {
    if (
      connection.providerCode !==
      "geodata.maptiler"
    ) {
      throw new Error(
        `MapTilerAdapter requires geodata.maptiler connection, got: ${connection.providerCode}`,
      );
    }
  }


  async geocode(
    query: string,
  ): Promise<GeocodedPlace[]> {
    const normalized =
      query.trim();


    if (!normalized) {
      throw new Error(
        "Geocode query is required",
      );
    }


    const apiKey =
      requireString(
        this.connection.secrets.apiKey,
        "secret apiKey",
      );


    const url =
      new URL(
        `${this.baseUrl}/geocoding/${encodeURIComponent(normalized)}.json`,
      );


    url.searchParams.set(
      "key",
      apiKey,
    );


    const defaultLanguage =
      this.connection.config
        .defaultLanguage;


    if (
      typeof defaultLanguage ===
        "string" &&
      defaultLanguage.trim()
    ) {
      url.searchParams.set(
        "language",
        defaultLanguage.trim(),
      );
    }


    const defaultCountry =
      this.connection.config
        .defaultCountry;


    if (
      typeof defaultCountry ===
        "string" &&
      defaultCountry.trim()
    ) {
      url.searchParams.set(
        "country",
        defaultCountry.trim(),
      );
    }


    const response =
      await fetch(
        url,
        {
          method:
            "GET",
        },
      );


    if (!response.ok) {
      const body =
        await response
          .text()
          .catch(
            () =>
              "",
          );


      throw new Error(
        `MapTiler API error ${response.status}: ${body.slice(0, 500)}`,
      );
    }


    const data =
      await response.json() as
        MapTilerGeocodingResponse;


    return (
      data.features ??
      []
    )
      .map(
        mapFeature,
      )
      .filter(
        (
          place,
        ): place is GeocodedPlace =>
          place !== undefined,
      );
  }


  async reverseGeocode(
    point:
      GeoPoint,
  ): Promise<GeocodedPlace[]> {
    if (
      !Number.isFinite(
        point.latitude,
      ) ||
      !Number.isFinite(
        point.longitude,
      )
    ) {
      throw new Error(
        "Reverse geocode requires valid latitude and longitude",
      );
    }


    if (
      point.latitude < -90 ||
      point.latitude > 90 ||
      point.longitude < -180 ||
      point.longitude > 180
    ) {
      throw new Error(
        "Reverse geocode coordinates are out of range",
      );
    }


    const apiKey =
      requireString(
        this.connection.secrets.apiKey,
        "secret apiKey",
      );


    const coordinates =
      `${point.longitude},${point.latitude}`;


    const url =
      new URL(
        `${this.baseUrl}/geocoding/${coordinates}.json`,
      );


    url.searchParams.set(
      "key",
      apiKey,
    );


    const defaultLanguage =
      this.connection.config
        .defaultLanguage;


    if (
      typeof defaultLanguage ===
        "string" &&
      defaultLanguage.trim()
    ) {
      url.searchParams.set(
        "language",
        defaultLanguage.trim(),
      );
    }


    const response =
      await fetch(
        url,
        {
          method:
            "GET",
        },
      );


    if (!response.ok) {
      const body =
        await response
          .text()
          .catch(
            () =>
              "",
          );


      throw new Error(
        `MapTiler API error ${response.status}: ${body.slice(0, 500)}`,
      );
    }


    const data =
      await response.json() as
        MapTilerGeocodingResponse;


    return (
      data.features ??
      []
    )
      .map(
        mapFeature,
      )
      .filter(
        (
          place,
        ): place is GeocodedPlace =>
          place !== undefined,
      );
  }
}
