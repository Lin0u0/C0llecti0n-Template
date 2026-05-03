type CollectionItem = {
    status?: string;
};

export function isPublicCollectionItem(item: CollectionItem): boolean {
    return !String(item.status || "").startsWith("want-to-");
}

export function publicCollectionItems<T extends CollectionItem>(items: T[]): T[] {
    return items.filter(isPublicCollectionItem);
}
