/**
 * Unified Type Definitions for C0llecti0n
 * All media types and shared interfaces
 */

// ==================== Base Types ====================

export interface BaseMedia {
    id: string;
    title: string;
    cover?: string;
    rating?: number;
    year?: number;
    country?: string;
    addedDate?: string;
    notes?: string;
}

export type BookStatus = "reading" | "completed" | "want-to-read";
export type MediaStatus = "watching" | "completed" | "want-to-watch";

// ==================== Specific Media Types ====================

export interface Book extends BaseMedia {
    author: string;
    status?: BookStatus;
    publisher?: string;
    platform?: string;
}

export interface Album extends BaseMedia {
    artist: string;
    genre?: string;
}

export interface Movie extends BaseMedia {
    director?: string;
    status?: MediaStatus;
    genre?: string;
    type: "movie";
}

export interface Series extends BaseMedia {
    director?: string;
    status?: MediaStatus;
    genre?: string;
    type: "series";
}

export type Media = Movie | Series;

// ==================== UI Component Types ====================

export interface BookSpineProps extends Book {
    // Inherits all Book fields
}

export interface VinylRecordProps extends Album {
    // Inherits all Album fields
}

export interface DiscCaseProps extends Media {
    // Inherits all Media fields
}

// ==================== Filter Types ====================

export type FilterType = "all" | "year" | "author" | "artist" | "director" | 
                         "country" | "added" | "status" | "type";

export type SortField = "added" | "rating" | "year" | "title";
export type SortDirection = "asc" | "desc";
export type SortValue = `${SortField}-${SortDirection}`;

export interface FilterState {
    [key: string]: string;
}

export interface FilterConfig {
    type: FilterType;
    label: string;
    options?: string[];
}

// ==================== Admin Types ====================

export type DataType = "books" | "movies" | "series" | "music";

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// ==================== Search Types ====================

export interface SearchItem {
    id: string;
    title: string;
    creator?: string;
    type: "book" | "album" | "movie" | "series";
    cover?: string;
    year?: number;
    country?: string;
    rating?: number;
    status?: string;
    addedDate?: string;
    // Type-specific fields
    publisher?: string;
    platform?: string;
    genre?: string;
    artist?: string;
    director?: string;
    author?: string;
    notes?: string;
}

// ==================== Theme Types ====================

export type Theme = "light" | "dark";
