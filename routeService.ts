import { getRoutes as routes, geocodeRoute as geocode, validPoint as validate } from './infra/lambda/routeService.mjs';
type Point = { lat: number; lon: number };
export const validPoint = (point: any): point is Point => validate(point);
export const getRoutes = (input: any): Promise<{success: boolean; routes: Array<{id: string; coordinates: Point[]; distanceKm: number; durationMin: number}>; source: string}> => routes(input);
export const geocodeRoute = (query: string): Promise<{success: boolean; results: Array<Point & {name: string}>}> => geocode(query);
