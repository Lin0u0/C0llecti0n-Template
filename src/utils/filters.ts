/**
 * Filter and Sort Utilities
 * Shared logic for filtering and sorting media items
 */

import type { SortValue, FilterState } from "../types";

/**
 * Extract year from addedDate string (YYYY-MM-DD format)
 */
export function getAddedYear(addedDate: string | undefined): string {
    return (addedDate || "").substring(0, 4);
}

/**
 * Split slash-separated values (e.g., "美国 / 英国" -> ["美国", "英国"])
 */
export function splitBySlash(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(/\s*\/\s*/)
        .map((v) => v.trim())
        .filter(Boolean);
}

/**
 * Extract unique values from items, supporting slash-separated values
 */
export function extractFilterOptions<T>(
    items: T[],
    getter: (item: T) => string | undefined,
): string[] {
    const allValues = items.flatMap((item) => {
        const value = getter(item);
        return splitBySlash(value);
    });
    return [...new Set(allValues)].sort();
}

/**
 * Extract unique numeric values (descending order)
 */
export function extractNumericOptions<T>(
    items: T[],
    getter: (item: T) => number | undefined,
): number[] {
    const values = items.map(getter).filter((v): v is number => v !== undefined);
    return [...new Set(values)].sort((a, b) => b - a);
}

// ==================== Filter Logic ====================

export interface FilterMatchOptions {
    itemValue: string | undefined;
    filterValue: string;
    matchMode?: "exact" | "contains";
}

/**
 * Check if an item matches a filter value
 */
export function matchesFilter(options: FilterMatchOptions): boolean {
    const { itemValue, filterValue, matchMode = "contains" } = options;
    
    if (filterValue === "all") return true;
    if (!itemValue) return false;
    
    if (matchMode === "exact") {
        return itemValue === filterValue;
    }
    
    // Contains mode - check if any of the slash-separated values match
    const itemValues = splitBySlash(itemValue);
    return itemValues.includes(filterValue);
}

/**
 * Filter items based on filter state
 */
export function filterItems<T extends Record<string, any>>(
    items: T[],
    filters: FilterState,
    fieldMapping: Record<string, (item: T) => string | undefined>,
): T[] {
    return items.filter((item) => {
        return Object.entries(filters).every(([filterType, filterValue]) => {
            if (filterValue === "all") return true;
            
            const getter = fieldMapping[filterType];
            if (!getter) return true;
            
            const itemValue = getter(item);
            return matchesFilter({ itemValue, filterValue });
        });
    });
}

// ==================== Sort Logic ====================

export interface SortOptions<T> {
    field: SortValue;
    getters: {
        added: (item: T) => string | undefined;
        rating: (item: T) => number | undefined;
        year: (item: T) => number | undefined;
        title: (item: T) => string | undefined;
    };
}

/**
 * Sort items based on sort value (field-direction)
 */
export function sortItems<T>(
    items: T[],
    sortValue: SortValue,
    getters: SortOptions<T>["getters"],
): T[] {
    const [field, direction] = sortValue.split("-") as [string, "asc" | "desc"];
    
    const sorted = [...items];
    
    sorted.sort((a, b) => {
        let aVal: string | number | undefined;
        let bVal: string | number | undefined;
        
        switch (field) {
            case "added":
                aVal = getters.added(a) || "1970-01-01";
                bVal = getters.added(b) || "1970-01-01";
                break;
            case "rating":
                aVal = getters.rating(a) || 0;
                bVal = getters.rating(b) || 0;
                break;
            case "year":
                aVal = getters.year(a) || 0;
                bVal = getters.year(b) || 0;
                break;
            case "title":
                aVal = (getters.title(a) || "").toLowerCase();
                bVal = (getters.title(b) || "").toLowerCase();
                break;
            default:
                return 0;
        }
        
        let result = 0;
        if (typeof aVal === "string" && typeof bVal === "string") {
            result = aVal.localeCompare(bVal);
        } else {
            result = (aVal as number) - (bVal as number);
        }
        
        return direction === "desc" ? -result : result;
    });
    
    return sorted;
}

// ==================== Client-side Filter/Sort Script Generator ====================

/**
 * Generate client-side filter script for a specific page
 * This reduces code duplication across pages
 */
export function generateFilterScript(options: {
    itemSelector: string;
    containerSelector: string;
    statsDisplaySelector: string;
    filterTypes: string[];
    fieldMapping: Record<string, string>;
}): string {
    const { itemSelector, containerSelector, statsDisplaySelector, filterTypes, fieldMapping } = options;
    
    return `
const filters = {
    ${filterTypes.map(type => `${type}: "all"`).join(",\n    ")}
};

let currentSort = "added-desc";

const chips = document.querySelectorAll(".filter-chip");
const items = document.querySelectorAll("${itemSelector}");
const itemsContainer = document.querySelector("${containerSelector}");
const statsDisplay = document.querySelector("${statsDisplaySelector}");
const totalCount = items.length;

function updateStats() {
    if (!statsDisplay) return;
    const visibleCount = Array.from(items).filter(
        (item) => (item as HTMLElement).style.display !== "none",
    ).length;

    if (visibleCount === totalCount) {
        statsDisplay.textContent = \`共计: \${totalCount}\`;
    } else {
        statsDisplay.textContent = \`显示 \${visibleCount} / \${totalCount}\`;
    }
}

function filterItems() {
    items.forEach((item) => {
        const itemEl = item as HTMLElement;
        ${filterTypes.map(type => {
            const dataAttr = fieldMapping[type] || type;
            return `const item${type.charAt(0).toUpperCase() + type.slice(1)} = itemEl.dataset.${dataAttr} || "";`;
        }).join("\n        ")}

        const matches = {
            ${filterTypes.map(type => {
                const dataAttr = fieldMapping[type] || type;
                return `${type}: filters.${type} === "all" || item${type.charAt(0).toUpperCase() + type.slice(1)}.includes(filters.${type})`;
            }).join(",\n            ")}
        };

        const allMatch = Object.values(matches).every(v => v);
        itemEl.style.display = allMatch ? "" : "none";
    });

    updateStats();
}

function sortItems() {
    if (!itemsContainer) return;
    const itemsArray = Array.from(items) as HTMLElement[];

    itemsArray.sort((a, b) => {
        const [field, direction] = currentSort.split("-");
        let aVal = "";
        let bVal = "";

        switch (field) {
            case "added":
                aVal = a.dataset.addedDate || "1970-01-01";
                bVal = b.dataset.addedDate || "1970-01-01";
                break;
            case "rating":
                aVal = parseFloat(a.dataset.rating || "0");
                bVal = parseFloat(b.dataset.rating || "0");
                break;
            case "year":
                aVal = parseInt(a.dataset.year || "0");
                bVal = parseInt(b.dataset.year || "0");
                break;
            case "title":
                aVal = (a.dataset.title || "").toLowerCase();
                bVal = (b.dataset.title || "").toLowerCase();
                break;
        }

        let result = 0;
        if (typeof aVal === "string") {
            result = aVal.localeCompare(bVal);
        } else {
            result = (aVal as number) - (bVal as number);
        }

        return direction === "desc" ? -result : result;
    });

    itemsArray.forEach((item) => itemsContainer.appendChild(item));
}

// Filter chip click handler
chips.forEach((chip) => {
    chip.addEventListener("click", () => {
        const el = chip as HTMLElement;
        const type = el.dataset.filterType;
        const value = el.dataset.value;
        
        if (!type) return;

        document
            .querySelectorAll(\`.filter-chip[data-filter-type="\${type}"]\`)
            .forEach((c) => c.classList.remove("active"));
        el.classList.add("active");

        filters[type] = value || "all";
        filterItems();
    });
});

// Status filter handler
window.addEventListener("status-filter-change", ((e: CustomEvent) => {
    filters.status = e.detail.status;
    filterItems();
}) as EventListener);

// Sort handler
window.addEventListener("sort-change", ((e: CustomEvent) => {
    currentSort = e.detail.sort;
    sortItems();
}) as EventListener);
`;
}
