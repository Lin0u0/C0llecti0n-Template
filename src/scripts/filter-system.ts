/**
 * Client-side Filter and Sort System
 * Used by library, cinema, and concert-hall pages
 */

export interface FilterSystemConfig {
    itemSelector: string;
    containerSelector: string;
    statsDisplayId: string;
    filterTypes: string[];
}

export class FilterSystem {
    private filters: Record<string, string> = {};
    private currentSort = "added-desc";
    private items: HTMLElement[] = [];
    private itemsContainer: HTMLElement | null = null;
    private statsDisplay: HTMLElement | null = null;
    private totalCount = 0;

    constructor(private config: FilterSystemConfig) {
        // Initialize filter state
        config.filterTypes.forEach(type => {
            this.filters[type] = "all";
        });
    }

    init() {
        this.items = Array.from(document.querySelectorAll(this.config.itemSelector));
        this.itemsContainer = document.querySelector(this.config.containerSelector);
        this.statsDisplay = document.getElementById(this.config.statsDisplayId);
        this.totalCount = this.items.length;

        this.bindFilterChips();
        this.bindEvents();
        this.updateStats();
    }

    private bindFilterChips() {
        const chips = document.querySelectorAll(".filter-chip");
        
        chips.forEach((chip) => {
            chip.addEventListener("click", () => {
                const el = chip as HTMLElement;
                const type = el.dataset.filterType;
                const value = el.dataset.value;
                
                if (!type) return;

                document
                    .querySelectorAll(`.filter-chip[data-filter-type="${type}"]`)
                    .forEach((c) => c.classList.remove("active"));
                el.classList.add("active");

                this.filters[type] = value || "all";
                this.filterItems();
            });
        });
    }

    private bindEvents() {
        // Status filter handler
        window.addEventListener("status-filter-change", ((e: CustomEvent) => {
            this.filters.status = e.detail.status;
            this.filterItems();
        }) as EventListener);

        // Sort handler
        window.addEventListener("sort-change", ((e: CustomEvent) => {
            this.currentSort = e.detail.sort;
            this.sortItems();
        }) as EventListener);
    }

    private filterItems() {
        this.items.forEach((item) => {
            const itemEl = item as HTMLElement;
            let shouldShow = true;

            for (const [filterType, filterValue] of Object.entries(this.filters)) {
                if (filterValue === "all") continue;

                const itemValue = itemEl.dataset[filterType] || "";
                
                // Handle added date specially - extract year
                if (filterType === "added") {
                    const itemYear = (itemEl.dataset.addedDate || "").substring(0, 4);
                    if (itemYear !== filterValue) {
                        shouldShow = false;
                        break;
                    }
                    continue;
                }

                // For other fields, check if item value contains filter value
                if (!itemValue.includes(filterValue)) {
                    shouldShow = false;
                    break;
                }
            }

            itemEl.style.display = shouldShow ? "" : "none";
        });

        this.updateStats();
    }

    private sortItems() {
        if (!this.itemsContainer) return;

        const [field, direction] = this.currentSort.split("-") as [string, "asc" | "desc"];

        this.items.sort((a, b) => {
            let aVal: string | number = "";
            let bVal: string | number = "";

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
                result = aVal.localeCompare(bVal as string);
            } else {
                result = (aVal as number) - (bVal as number);
            }

            return direction === "desc" ? -result : result;
        });

        this.items.forEach((item) => this.itemsContainer!.appendChild(item));
    }

    private updateStats() {
        if (!this.statsDisplay) return;
        const visibleCount = this.items.filter(
            (item) => item.style.display !== "none"
        ).length;

        if (visibleCount === this.totalCount) {
            this.statsDisplay.textContent = `共计: ${this.totalCount}`;
        } else {
            this.statsDisplay.textContent = `显示 ${visibleCount} / ${this.totalCount}`;
        }
    }
}

// Factory function for easy initialization
export function initFilterSystem(config: FilterSystemConfig) {
    const system = new FilterSystem(config);
    
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => system.init());
    } else {
        system.init();
    }
    
    return system;
}
