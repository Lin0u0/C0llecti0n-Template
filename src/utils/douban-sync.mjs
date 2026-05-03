import { load } from "cheerio";
import { createHash } from "crypto";
import { access, mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

const DEFAULT_DELAY_MS = 2500;
const PAGE_LIMIT = 200;

const DATA_TYPES = ["books", "movies", "series", "music"];

const TYPE_CONFIG = {
    books: {
        idPrefix: "book",
        origin: "https://book.douban.com",
        domain: "book",
        statuses: [
            { path: "collect", status: "completed" },
            { path: "do", status: "reading" },
            { path: "wish", status: "want-to-read" },
        ],
    },
    movies: {
        idPrefix: "movie",
        origin: "https://movie.douban.com",
        domain: "movie",
        doubanType: "movie",
        typeField: "movie",
        statuses: [
            { path: "collect", status: "completed" },
            { path: "do", status: "watching" },
            { path: "wish", status: "want-to-watch" },
        ],
    },
    series: {
        idPrefix: "series",
        origin: "https://movie.douban.com",
        domain: "movie",
        doubanType: "tv",
        typeField: "series",
        statuses: [
            { path: "collect", status: "completed" },
            { path: "do", status: "watching" },
            { path: "wish", status: "want-to-watch" },
        ],
    },
    music: {
        idPrefix: "music",
        origin: "https://music.douban.com",
        domain: "music",
        statuses: [
            { path: "collect", status: "completed" },
            { path: "do", status: "listening" },
            { path: "wish", status: "want-to-listen" },
        ],
    },
};

const KNOWN_COUNTRIES = [
    "中国大陆",
    "中国香港",
    "中国台湾",
    "中国",
    "日本",
    "韩国",
    "美国",
    "英国",
    "法国",
    "德国",
    "意大利",
    "西班牙",
    "印度",
    "泰国",
    "加拿大",
    "澳大利亚",
    "俄罗斯",
    "瑞典",
    "丹麦",
    "芬兰",
    "挪威",
    "荷兰",
    "比利时",
    "巴西",
    "墨西哥",
    "阿根廷",
];

const KNOWN_GENRES = [
    "剧情",
    "喜剧",
    "爱情",
    "动作",
    "科幻",
    "动画",
    "悬疑",
    "惊悚",
    "恐怖",
    "犯罪",
    "冒险",
    "奇幻",
    "战争",
    "历史",
    "传记",
    "纪录片",
    "音乐",
    "歌舞",
    "家庭",
    "儿童",
    "古装",
    "武侠",
    "灾难",
    "运动",
    "同性",
    "西部",
    "黑色电影",
];

function sleep(ms) {
    if (!ms) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .replace(/\u00a0/g, " ")
        .trim();
}

function splitIntro(intro) {
    return cleanText(intro)
        .split("/")
        .map((part) => cleanText(part))
        .filter(Boolean);
}

function normalizeProtocolUrl(value) {
    if (!value) return "";
    if (value.startsWith("//")) return `https:${value}`;
    return value;
}

function canonicalSubjectUrl(href, origin) {
    if (!href) return "";
    try {
        const url = new URL(href, origin);
        const match = url.pathname.match(/\/subject\/(\d+)\/?/);
        if (!match) return url.toString();
        return `${url.origin}/subject/${match[1]}/`;
    } catch {
        return "";
    }
}

function extractDoubanId(url) {
    const match = String(url || "").match(/\/subject\/(\d+)\/?/);
    return match?.[1] || "";
}

function normalizeTitle(value) {
    return cleanText(value)
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[《》「」『』"'“”‘’\s:：,，.。/\\\-_\(\)（）\[\]!！?？]+/g, "");
}

function hasChineseTitle(value) {
    const text = String(value || "");
    return /[\u3400-\u9fff]/.test(text) && !/[\u3040-\u30ff\uac00-\ud7af]/.test(text);
}

function uniqueValues(values) {
    const seen = new Set();
    const result = [];
    for (const value of values.map(cleanText).filter(Boolean)) {
        const key = normalizeTitle(value);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(value);
    }
    return result;
}

function splitTitleCandidates(value) {
    return cleanText(value)
        .split(/\s+\/\s+/)
        .map((part) => cleanText(part))
        .filter(Boolean);
}

function extractYear(value) {
    const match = String(value || "").match(/(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/);
    return match ? Number(match[1]) : undefined;
}

function extractAddedDate($item) {
    const text = cleanText($item.find(".date").first().text() || $item.text());
    return text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
}

function extractRating($item) {
    let ratingClass = "";
    $item.find("[class]").each((_, el) => {
        const className = String(el.attribs?.class || "");
        if (/rating\d-t/.test(className)) {
            ratingClass = className;
            return false;
        }
        return undefined;
    });

    const stars = ratingClass.match(/rating(\d)-t/)?.[1];
    return stars ? Number(stars) * 2 : undefined;
}

function extractComment($item) {
    const $comment = $item.find(".comment").first().clone();
    $comment.find(".pl").remove();
    const comment = cleanText($comment.text());
    return comment || undefined;
}

function extractTitleInfo($item) {
    const titleLinkText = cleanText($item.find(".title a, h2 a").first().text());
    const candidates = uniqueValues([
        ...splitTitleCandidates(titleLinkText),
        cleanText($item.find(".title em").first().text()),
        cleanText($item.find("h2 a[title]").first().attr("title")),
        cleanText($item.find("a.nbg").first().attr("title")),
        cleanText($item.find(".pic img").first().attr("alt")),
    ]);

    const title = candidates.find(hasChineseTitle) || candidates[0] || "";
    const originalTitle = candidates.find((candidate) => normalizeTitle(candidate) !== normalizeTitle(title));

    return {
        title,
        originalTitle,
    };
}

function extractCountry(parts) {
    const countries = [];
    for (const part of parts) {
        if (KNOWN_COUNTRIES.includes(part) && !countries.includes(part)) {
            countries.push(part);
        }
    }
    return countries.length ? countries.join(" / ") : undefined;
}

function extractGenre(parts) {
    const genres = [];
    for (const part of parts) {
        if (KNOWN_GENRES.includes(part) && !genres.includes(part)) {
            genres.push(part);
        }
    }
    return genres.length ? genres.join(" / ") : undefined;
}

function parseBook(entry, parts) {
    const dateIndex = parts.findIndex((part) => /\b(?:19|20)\d{2}(?:-\d{1,2})?\b/.test(part));
    const publisherIndex = dateIndex > 0 ? dateIndex - 1 : 1;
    const authorParts = parts.slice(0, Math.max(1, publisherIndex));

    return {
        ...entry,
        author: authorParts.join(" / ") || "未知作者",
        publisher: parts[publisherIndex],
        year: extractYear(parts.join(" / ")),
    };
}

function parseMusic(entry, parts) {
    return {
        ...entry,
        artist: parts[0] || "未知艺术家",
        year: extractYear(parts.join(" / ")),
        genre: parts.at(-1),
    };
}

function parseVideo(entry, parts, typeField) {
    return {
        ...entry,
        type: typeField,
        year: extractYear(parts.join(" / ")),
        country: extractCountry(parts),
        genre: extractGenre(parts),
    };
}

function buildCollectionUrl(config, userId, statusPath, start) {
    const url = new URL(`/people/${encodeURIComponent(userId)}/${statusPath}`, config.origin);
    url.searchParams.set("start", String(start));
    url.searchParams.set("sort", "time");
    url.searchParams.set("mode", "grid");
    url.searchParams.set("filter", "all");
    url.searchParams.set("tags_sort", "count");
    if (config.domain === "movie") {
        url.searchParams.set("type", config.doubanType || "all");
    }
    if (config.domain === "music") {
        url.searchParams.set("rating", "all");
    }
    return url.toString();
}

function resolveNextUrl($, origin) {
    const nextHref = $('link[rel="next"]').attr("href") || $("a")
        .filter((_, el) => cleanText($(el).text()).includes("后页"))
        .first()
        .attr("href");
    if (!nextHref) return "";
    try {
        return new URL(nextHref, origin).toString();
    } catch {
        return "";
    }
}

export function parseCollectionPage(html, { dataType, status }) {
    const config = TYPE_CONFIG[dataType];
    if (!config) throw new Error(`Unknown Douban data type: ${dataType}`);

    const $ = load(html);
    const parsedItems = [];
    const seen = new Set();
    const itemNodes = $(".grid-view .item, ul.list-view > li.item, .item.comment-item, li.subject-item").toArray();

    for (const node of itemNodes) {
        const $item = $(node);
        const $link = $item
            .find("a.nbg[href*='/subject/'], .title a[href*='/subject/'], a[href*='/subject/']")
            .first();
        const doubanUrl = canonicalSubjectUrl($link.attr("href"), config.origin);
        const doubanId = extractDoubanId(doubanUrl);
        const titleInfo = extractTitleInfo($item);
        const title = titleInfo.title;

        if (!doubanId || !title || seen.has(doubanId)) continue;
        seen.add(doubanId);

        const intro = cleanText($item.find(".intro").first().text() || $item.find(".pub").first().text());
        const parts = splitIntro(intro);
        const baseEntry = {
            title,
            status,
            cover: normalizeProtocolUrl($item.find(".pic img").first().attr("src")),
            rating: extractRating($item),
            addedDate: extractAddedDate($item),
            notes: extractComment($item),
            doubanId,
            doubanUrl,
            source: "douban",
        };
        if (titleInfo.originalTitle) baseEntry.originalTitle = titleInfo.originalTitle;

        if (dataType === "books") parsedItems.push(parseBook(baseEntry, parts));
        if (dataType === "music") parsedItems.push(parseMusic(baseEntry, parts));
        if (dataType === "movies" || dataType === "series") {
            parsedItems.push(parseVideo(baseEntry, parts, config.typeField));
        }
    }

    return {
        items: parsedItems,
        nextUrl: resolveNextUrl($, config.origin),
    };
}

async function fetchHtml(url, { cookie } = {}) {
    const headers = {
        "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
        Referer: "https://www.douban.com/",
    };
    if (cookie) headers.Cookie = cookie;

    const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(30000),
    });

    if (response.status === 403) {
        throw new Error(`Douban blocked the request for ${url}; provide a logged-in Douban Cookie`);
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} while fetching ${url}`);
    }

    const html = await response.text();
    if (
        response.url.includes("sec.douban.com") ||
        /403 Forbidden|检测到有异常请求|sec\.douban\.com|请点击下方按钮继续浏览/.test(html)
    ) {
        throw new Error(`Douban blocked the request for ${url}; provide a logged-in Douban Cookie`);
    }
    return html;
}

async function fetchCollection({ userId, dataType, statusConfig, delayMs, cookie }) {
    const config = TYPE_CONFIG[dataType];
    const collected = [];
    const seenUrls = new Set();
    let currentUrl = buildCollectionUrl(config, userId, statusConfig.path, 0);
    let pageCount = 0;

    while (currentUrl && !seenUrls.has(currentUrl) && pageCount < PAGE_LIMIT) {
        seenUrls.add(currentUrl);
        const html = await fetchHtml(currentUrl, { cookie });
        const page = parseCollectionPage(html, {
            dataType,
            status: statusConfig.status,
        });
        collected.push(...page.items);
        pageCount += 1;

        if (!page.nextUrl) break;
        currentUrl = page.nextUrl;
        await sleep(delayMs);
    }

    return collected;
}

function generateId(type, items) {
    const prefix = TYPE_CONFIG[type].idPrefix;
    const maxId = items.reduce((max, item) => {
        const match = item.id?.match(new RegExp(`^${prefix}-(\\d+)$`));
        return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `${prefix}-${maxId + 1}`;
}

function isEmptyValue(value) {
    return value === undefined || value === null || value === "";
}

function titleKeys(item) {
    return uniqueValues([item.title, item.originalTitle]);
}

function stripBookSeriesSuffix(value) {
    return cleanText(value)
        .replace(/\s*[（(][^（）()]*读库文存[^（）()]*[）)]\s*$/, "")
        .trim();
}

function titleMatchKeys(item) {
    const keys = titleKeys(item);
    return uniqueValues([...keys, ...keys.map(stripBookSeriesSuffix)]).map(normalizeTitle).filter(Boolean);
}

function creatorTokens(value) {
    return String(value || "")
        .split(/[\/、,，;；]/)
        .map((part) =>
            normalizeTitle(
                cleanText(part)
                    .replace(/^[\[［【(（][^\]］】)）]+[\]］】)）]\s*/, "")
                    .replace(/\s*(编著|编选|编|著|译|等)\s*$/g, ""),
            ),
        )
        .filter((part) => part.length >= 2);
}

function bookAuthorsCompatible(item, incoming) {
    if (!item.author || !incoming.author) return false;
    const itemAuthors = creatorTokens(item.author);
    const incomingAuthors = creatorTokens(incoming.author);
    return itemAuthors.some((author) => incomingAuthors.includes(author));
}

function titleVariantsMatch(left, right) {
    if (!left || !right) return false;
    if (left === right) return true;

    const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
    if (shorter.length < 10) return false;
    if (shorter.length / longer.length < 0.62) return false;

    return longer.includes(shorter);
}

function coverImageKey(value) {
    const match = String(value || "").match(/(p\d+)/i);
    return match?.[1]?.toLowerCase() || "";
}

function sameCoverImage(item, incoming) {
    const itemKey = coverImageKey(item.cover);
    const incomingKey = coverImageKey(incoming.cover);
    return Boolean(itemKey && incomingKey && itemKey === incomingKey);
}

function yearsCompatible(a, b) {
    return !a || !b || Number(a) === Number(b) || Math.abs(Number(a) - Number(b)) <= 1;
}

function ratingsCompatible(a, b) {
    return !a || !b || Math.abs(Number(a) - Number(b)) <= 1;
}

function normalizeCountry(value) {
    return String(value || "").replace(/^中国$/, "中国大陆").trim();
}

function countrySet(value) {
    return new Set(
        String(value || "")
            .split(/\s*\/\s*/)
            .map(normalizeCountry)
            .filter(Boolean),
    );
}

function countriesCompatible(a, b) {
    const left = countrySet(a);
    const right = countrySet(b);
    if (!left.size || !right.size) return true;
    return [...left].some((country) => right.has(country));
}

function isWantedStatus(status) {
    return String(status || "").startsWith("want-to-");
}

function fuzzyMatchMetadataCompatible(item, incoming, { ignoreType = false } = {}) {
    if (!ignoreType && item.type && incoming.type && item.type !== incoming.type) return false;
    if (item.status && incoming.status && item.status !== incoming.status) return false;
    return true;
}

function sameTitle(item, incoming) {
    const itemTitles = titleMatchKeys(item);
    const incomingTitles = titleMatchKeys(incoming);
    return itemTitles.some((title) => incomingTitles.some((incomingTitle) => titleVariantsMatch(title, incomingTitle)));
}

function sameTitleMetadataCompatible(item, incoming) {
    if (bookAuthorsCompatible(item, incoming)) return true;
    return yearsCompatible(item.year, incoming.year);
}

function hasConflictingDoubanIdentity(item, incoming) {
    return Boolean(item.doubanId && incoming.doubanId && item.doubanId !== incoming.doubanId);
}

function hasSameDoubanIdentity(item, incoming) {
    if (incoming.doubanId && item.doubanId === incoming.doubanId) return true;
    if (incoming.doubanUrl && item.doubanUrl === incoming.doubanUrl) return true;
    return false;
}

function isLikelyTranslatedDuplicate(item, incoming, { ignoreType = false } = {}) {
    if (hasConflictingDoubanIdentity(item, incoming)) return false;
    if (item.source === "douban" && incoming.source === "douban") return false;
    if (sameTitle(item, incoming)) return false;
    if (!item.type && !incoming.type) return false;
    if (!ignoreType && item.type && incoming.type && item.type !== incoming.type) return false;
    if (isWantedStatus(item.status) || isWantedStatus(incoming.status)) return false;
    if (item.status && incoming.status && item.status !== incoming.status) return false;
    if (!item.addedDate || !incoming.addedDate || item.addedDate !== incoming.addedDate) return false;
    if (!yearsCompatible(item.year, incoming.year)) return false;
    if (!ratingsCompatible(item.rating, incoming.rating)) return false;
    if (!countriesCompatible(item.country, incoming.country)) return false;

    return hasChineseTitle(item.title) !== hasChineseTitle(incoming.title);
}

function findMatchingIndex(items, incoming) {
    const exactIndex = items.findIndex((item) => hasSameDoubanIdentity(item, incoming));
    if (exactIndex !== -1) return exactIndex;

    const titleIndex = items.findIndex(
        (item) =>
            !hasConflictingDoubanIdentity(item, incoming) &&
            fuzzyMatchMetadataCompatible(item, incoming) &&
            sameTitle(item, incoming) &&
            sameTitleMetadataCompatible(item, incoming),
    );
    if (titleIndex !== -1) return titleIndex;

    const coverIndex = items.findIndex(
        (item) =>
            !hasConflictingDoubanIdentity(item, incoming) &&
            fuzzyMatchMetadataCompatible(item, incoming) &&
            sameCoverImage(item, incoming) &&
            yearsCompatible(item.year, incoming.year) &&
            ratingsCompatible(item.rating, incoming.rating) &&
            countriesCompatible(item.country, incoming.country),
    );
    if (coverIndex !== -1) return coverIndex;

    const translatedMatches = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => isLikelyTranslatedDuplicate(item, incoming));

    return translatedMatches.length === 1 ? translatedMatches[0].index : -1;
}

function preferIncomingTitle(target, incoming) {
    return !hasChineseTitle(target.title) && hasChineseTitle(incoming.title);
}

function fillMissingFields(target, incoming) {
    let changed = false;
    if (!isEmptyValue(incoming.title) && preferIncomingTitle(target, incoming)) {
        if (!target.originalTitle && target.title) target.originalTitle = target.title;
        target.title = incoming.title;
        changed = true;
    } else if (!target.originalTitle && incoming.title && normalizeTitle(target.title) !== normalizeTitle(incoming.title)) {
        target.originalTitle = incoming.title;
        changed = true;
    }

    if (!target.originalTitle && incoming.originalTitle) {
        target.originalTitle = incoming.originalTitle;
        changed = true;
    }

    for (const [key, value] of Object.entries(incoming)) {
        if (key === "id" || key === "source") continue;
        if (key === "title" || key === "originalTitle") continue;
        if (isEmptyValue(value)) continue;
        if (isEmptyValue(target[key])) {
            target[key] = value;
            changed = true;
        }
    }
    return changed;
}

function comparePreferredItem(candidate, current) {
    const candidateManual = candidate.source !== "douban";
    const currentManual = current.source !== "douban";
    if (candidateManual !== currentManual) return candidateManual ? -1 : 1;

    const candidatePublic = !isWantedStatus(candidate.status);
    const currentPublic = !isWantedStatus(current.status);
    if (candidatePublic !== currentPublic) return candidatePublic ? -1 : 1;

    const candidateChinese = hasChineseTitle(candidate.title);
    const currentChinese = hasChineseTitle(current.title);
    if (candidateChinese !== currentChinese) return candidateChinese ? -1 : 1;

    const candidateHasCover = !isEmptyValue(candidate.cover);
    const currentHasCover = !isEmptyValue(current.cover);
    if (candidateHasCover !== currentHasCover) return candidateHasCover ? -1 : 1;

    return 0;
}

function dedupeItems(items) {
    const result = [];
    let removed = 0;

    for (const item of items) {
        const incoming = structuredClone(item);
        const matchIndex = findMatchingIndex(result, incoming);

        if (matchIndex === -1) {
            result.push(incoming);
            continue;
        }

        removed += 1;
        const current = result[matchIndex];
        if (comparePreferredItem(incoming, current) < 0) {
            fillMissingFields(incoming, current);
            result[matchIndex] = incoming;
        } else {
            fillMissingFields(current, incoming);
        }
    }

    return { items: result, removed };
}

function sameAddedDate(item, incoming) {
    return Boolean(item.addedDate && incoming.addedDate && item.addedDate === incoming.addedDate);
}

function isCrossTypeVideoDuplicate(item, incoming) {
    if (hasSameDoubanIdentity(item, incoming)) return true;
    if (hasConflictingDoubanIdentity(item, incoming)) return false;
    if (!fuzzyMatchMetadataCompatible(item, incoming, { ignoreType: true })) return false;
    if (!yearsCompatible(item.year, incoming.year)) return false;
    if (!ratingsCompatible(item.rating, incoming.rating)) return false;
    if (!countriesCompatible(item.country, incoming.country)) return false;

    if (sameTitle(item, incoming) && sameAddedDate(item, incoming)) return true;
    if (sameCoverImage(item, incoming)) return true;
    return isLikelyTranslatedDuplicate(item, incoming, { ignoreType: true });
}

function dedupeVideoCrossType(data) {
    let removedMovies = 0;
    let removedSeries = 0;

    for (let seriesIndex = 0; seriesIndex < data.series.length; seriesIndex += 1) {
        const seriesItem = data.series[seriesIndex];
        const movieIndex = data.movies.findIndex((movieItem) => isCrossTypeVideoDuplicate(movieItem, seriesItem));
        if (movieIndex === -1) continue;

        const movieItem = data.movies[movieIndex];
        if (comparePreferredItem(seriesItem, movieItem) < 0) {
            fillMissingFields(seriesItem, movieItem);
            data.series[seriesIndex] = seriesItem;
            data.movies.splice(movieIndex, 1);
            removedMovies += 1;
        } else {
            fillMissingFields(movieItem, seriesItem);
            data.movies[movieIndex] = movieItem;
            data.series.splice(seriesIndex, 1);
            seriesIndex -= 1;
            removedSeries += 1;
        }
    }

    return { movies: removedMovies, series: removedSeries };
}

export function dedupeCollectionData(collectionData, dataTypes) {
    const selectedDataTypes = normalizeDataTypes(dataTypes);
    const data = Object.fromEntries(
        DATA_TYPES.map((type) => [type, Array.isArray(collectionData[type]) ? structuredClone(collectionData[type]) : []]),
    );
    const summary = Object.fromEntries(DATA_TYPES.map((type) => [type, { removed: 0 }]));

    for (const type of selectedDataTypes) {
        const { items, removed } = dedupeItems(data[type]);
        data[type] = items;
        summary[type] = { removed };
    }

    if (selectedDataTypes.includes("movies") && selectedDataTypes.includes("series")) {
        const removed = dedupeVideoCrossType(data);
        summary.movies.removed += removed.movies;
        summary.series.removed += removed.series;
    }

    return { data, summary };
}

function normalizeDataTypes(dataTypes) {
    if (!dataTypes) return DATA_TYPES;

    const requested = Array.isArray(dataTypes) ? dataTypes : [dataTypes];
    const normalized = requested
        .map((type) => cleanText(type))
        .filter(Boolean);
    const invalidTypes = normalized.filter((type) => !DATA_TYPES.includes(type));

    if (invalidTypes.length) {
        const error = new Error(`Unknown Douban data type: ${invalidTypes.join(", ")}`);
        error.statusCode = 400;
        throw error;
    }

    return normalized.length ? [...new Set(normalized)] : DATA_TYPES;
}

async function fileExists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

function coverExtension(url, contentType) {
    const pathname = (() => {
        try {
            return new URL(url).pathname;
        } catch {
            return "";
        }
    })();
    const pathExt = pathname.match(/\.(jpe?g|png|webp|gif)$/i)?.[0]?.toLowerCase();
    if (pathExt) return pathExt === ".jpeg" ? ".jpg" : pathExt;
    if (contentType?.includes("png")) return ".png";
    if (contentType?.includes("webp")) return ".webp";
    if (contentType?.includes("gif")) return ".gif";
    return ".jpg";
}

async function downloadCover(coverUrl, doubanId, coversDir, cookie) {
    if (!coverUrl || !/^https?:\/\//.test(coverUrl)) return coverUrl;

    const hash = createHash("sha1").update(coverUrl).digest("hex").slice(0, 8);
    const provisionalName = `douban-${doubanId}-${hash}`;

    await mkdir(coversDir, { recursive: true });

    const headers = {
        "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://www.douban.com/",
    };
    if (cookie) headers.Cookie = cookie;

    const response = await fetch(coverUrl, {
        headers,
        signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} while downloading cover`);

    const contentType = response.headers.get("content-type") || "";
    const ext = coverExtension(coverUrl, contentType);
    const filename = `${provisionalName}${ext}`;
    const filePath = join(coversDir, filename);

    if (!(await fileExists(filePath))) {
        const buffer = Buffer.from(await response.arrayBuffer());
        await writeFile(filePath, buffer);
    }

    return `/covers/${filename}`;
}

async function localizeCover(entry, coversDir, cookie, failures) {
    if (!entry.cover || entry.cover.startsWith("/covers/")) return entry;
    try {
        return {
            ...entry,
            cover: await downloadCover(entry.cover, entry.doubanId, coversDir, cookie),
        };
    } catch (error) {
        failures.push({
            type: "cover",
            title: entry.title,
            doubanUrl: entry.doubanUrl,
            message: error.message,
        });
        return entry;
    }
}

export async function mergeSyncedEntries(existingData, syncedEntries, { coversDir, cookie, dedupeDataTypes } = {}) {
    const nextData = Object.fromEntries(
        DATA_TYPES.map((type) => [type, Array.isArray(existingData[type]) ? structuredClone(existingData[type]) : []]),
    );
    const byType = Object.fromEntries(
        DATA_TYPES.map((type) => [type, { added: 0, updated: 0, skipped: 0, failed: 0 }]),
    );
    const failures = [];

    for (const type of DATA_TYPES) {
        const items = nextData[type];
        for (const rawEntry of syncedEntries[type] || []) {
            const matchIndex = findMatchingIndex(items, rawEntry);

            if (matchIndex === -1) {
                const entry = await localizeCover(rawEntry, coversDir, cookie, failures);
                items.unshift({
                    id: generateId(type, items),
                    ...entry,
                });
                byType[type].added += 1;
                continue;
            }

            const existingItem = items[matchIndex];
            const entry = isEmptyValue(existingItem.cover)
                ? await localizeCover(rawEntry, coversDir, cookie, failures)
                : rawEntry;
            const changed = fillMissingFields(items[matchIndex], entry);
            if (changed) {
                byType[type].updated += 1;
            } else {
                byType[type].skipped += 1;
            }
        }
    }

    for (const failure of failures) {
        const matchingType = DATA_TYPES.find((type) =>
            (syncedEntries[type] || []).some((entry) => entry.doubanUrl === failure.doubanUrl),
        );
        if (matchingType) byType[matchingType].failed += 1;
    }

    const dedupeResult = dedupeCollectionData(nextData, dedupeDataTypes);

    return { data: dedupeResult.data, byType, failures, deduped: dedupeResult.summary };
}

async function readJson(path) {
    return JSON.parse(await readFile(path, "utf-8"));
}

async function writeJson(path, data) {
    await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function summarize(byType) {
    const totals = { added: 0, updated: 0, skipped: 0, failed: 0 };
    for (const stats of Object.values(byType)) {
        totals.added += stats.added;
        totals.updated += stats.updated;
        totals.skipped += stats.skipped;
        totals.failed += stats.failed;
    }
    return totals;
}

export async function syncDoubanCollection({
    userId,
    dataTypes,
    dataFiles,
    coversDir,
    delayMs = DEFAULT_DELAY_MS,
    cookie,
} = {}) {
    if (!userId) {
        const error = new Error("Douban user ID is required");
        error.statusCode = 400;
        throw error;
    }
    const selectedDataTypes = normalizeDataTypes(dataTypes);

    const existingData = {};
    for (const type of DATA_TYPES) {
        existingData[type] = await readJson(dataFiles[type]);
    }

    const syncedEntries = Object.fromEntries(DATA_TYPES.map((type) => [type, []]));
    const sourceFailures = [];

    for (const type of selectedDataTypes) {
        const config = TYPE_CONFIG[type];
        for (const statusConfig of config.statuses) {
            try {
                const entries = await fetchCollection({
                    userId,
                    dataType: type,
                    statusConfig,
                    delayMs,
                    cookie,
                });
                syncedEntries[type].push(...entries);
            } catch (error) {
                sourceFailures.push({
                    type,
                    status: statusConfig.status,
                    message: error.message,
                });
            }
            await sleep(delayMs);
        }
    }

    const mergeResult = await mergeSyncedEntries(existingData, syncedEntries, {
        coversDir,
        cookie,
        dedupeDataTypes: selectedDataTypes,
    });
    const fetchedCount = Object.values(syncedEntries).reduce((total, entries) => total + entries.length, 0);

    for (const type of selectedDataTypes) {
        mergeResult.byType[type].failed += sourceFailures.filter((failure) => failure.type === type).length;
    }

    const totals = summarize(mergeResult.byType);
    if (fetchedCount === 0 && sourceFailures.length > 0) {
        const error = new Error("Douban sync failed before any data could be imported");
        error.statusCode = 502;
        error.details = sourceFailures;
        throw error;
    }

    for (const type of DATA_TYPES) {
        await writeJson(dataFiles[type], mergeResult.data[type]);
    }

    return {
        success: true,
        ...summarize(mergeResult.byType),
        byType: mergeResult.byType,
        failed: summarize(mergeResult.byType).failed,
        deduped: mergeResult.deduped,
        failures: [...sourceFailures, ...mergeResult.failures],
    };
}
