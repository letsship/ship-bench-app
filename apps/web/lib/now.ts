import { cache } from "react";

export const getNow = cache((): string => new Date().toISOString());