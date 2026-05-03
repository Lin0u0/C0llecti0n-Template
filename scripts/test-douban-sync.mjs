import assert from "node:assert/strict";
import { parseCollectionPage, mergeSyncedEntries, dedupeCollectionData } from "../src/utils/douban-sync.mjs";

const movieHtml = `
<div class="grid-view">
  <div class="item comment-item">
    <div class="pic">
      <a title="我不是药神" href="https://movie.douban.com/subject/26752088/" class="nbg">
        <img alt="我不是药神" src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2527119568.jpg">
      </a>
    </div>
    <div class="info">
      <ul>
        <li class="title"><a href="https://movie.douban.com/subject/26752088/"><em>我不是药神</em> / 中国药神</a></li>
        <li class="intro">2018-07-05(中国大陆) / 徐峥 / 中国大陆 / 文牧野 / 117分钟 / 剧情 / 喜剧 / 汉语普通话</li>
        <li><span class="rating5-t"></span><span class="date">2018-07-16</span></li>
      </ul>
    </div>
  </div>
</div>`;

const musicHtml = `
<div class="grid-view">
  <div class="item comment-item">
    <div class="pic">
      <a title="新长征路上的摇滚" href="https://music.douban.com/subject/1394742/" class="nbg">
        <img alt="新长征路上的摇滚" src="https://img3.doubanio.com/view/subject/s/public/s8868552.jpg">
      </a>
    </div>
    <div class="info">
      <ul>
        <li class="title"><a href="https://music.douban.com/subject/1394742/">新长征路上的摇滚</a></li>
        <li class="intro">崔健 / 1989-02-01 / 专辑 / CD / 摇滚</li>
        <li><span class="rating4-t"></span><span class="date">2007-11-12</span></li>
      </ul>
    </div>
  </div>
</div>`;

const translatedMovieHtml = `
<div class="grid-view">
  <div class="item comment-item">
    <div class="pic">
      <a title="All Her Fault" href="https://movie.douban.com/subject/36778966/" class="nbg">
        <img alt="All Her Fault" src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2926850313.jpg">
      </a>
    </div>
    <div class="info">
      <ul>
        <li class="title"><a href="https://movie.douban.com/subject/36778966/"><em>All Her Fault</em> / 都是她的错</a></li>
        <li class="intro">2025-11-06(美国) / 美国 / 澳大利亚 / 剧情 / 悬疑</li>
        <li><span class="rating5-t"></span><span class="date">2026-02-10</span></li>
      </ul>
    </div>
  </div>
</div>`;

const bookHtml = `
<ul class="interest-list">
  <li class="subject-item">
    <div class="pic">
      <a class="nbg" href="https://book.douban.com/subject/26642302/">
        <img src="https://img9.doubanio.com/view/subject/s/public/s29011584.jpg" width="90">
      </a>
    </div>
    <div class="info">
      <h2>
        <a href="https://book.douban.com/subject/26642302/" title="About Face 4: 交互设计精髓">About Face 4: 交互设计精髓</a>
      </h2>
      <div class="pub">[美] 艾伦·库伯、[美] 罗伯特·莱曼 / 倪卫国、刘松涛 / 电子工出版社 / 2015-10 / 118.00元</div>
      <div class="short-note">
        <span class="date">2026-04-15 想读</span>
        <p class="comment comment-item"></p>
      </div>
    </div>
  </li>
</ul>`;

const moviePage = parseCollectionPage(movieHtml, {
    dataType: "movies",
    status: "completed",
});

assert.equal(moviePage.items.length, 1);
assert.equal(moviePage.items[0].title, "我不是药神");
assert.equal(moviePage.items[0].doubanId, "26752088");
assert.equal(moviePage.items[0].rating, 10);
assert.equal(moviePage.items[0].year, 2018);
assert.equal(moviePage.items[0].country, "中国大陆");
assert.equal(moviePage.items[0].genre, "剧情 / 喜剧");
assert.equal(moviePage.items[0].type, "movie");

const musicPage = parseCollectionPage(musicHtml, {
    dataType: "music",
    status: "listening",
});

assert.equal(musicPage.items.length, 1);
assert.equal(musicPage.items[0].artist, "崔健");
assert.equal(musicPage.items[0].genre, "摇滚");
assert.equal(musicPage.items[0].status, "listening");

const translatedMoviePage = parseCollectionPage(translatedMovieHtml, {
    dataType: "series",
    status: "completed",
});

assert.equal(translatedMoviePage.items.length, 1);
assert.equal(translatedMoviePage.items[0].title, "都是她的错");
assert.equal(translatedMoviePage.items[0].originalTitle, "All Her Fault");
assert.equal(translatedMoviePage.items[0].doubanId, "36778966");

const bookPage = parseCollectionPage(bookHtml, {
    dataType: "books",
    status: "want-to-read",
});

assert.equal(bookPage.items.length, 1);
assert.equal(bookPage.items[0].title, "About Face 4: 交互设计精髓");
assert.equal(bookPage.items[0].author, "[美] 艾伦·库伯、[美] 罗伯特·莱曼 / 倪卫国、刘松涛");
assert.equal(bookPage.items[0].publisher, "电子工出版社");
assert.equal(bookPage.items[0].year, 2015);
assert.equal(bookPage.items[0].addedDate, "2026-04-15");
assert.equal(bookPage.items[0].doubanId, "26642302");

const mergeResult = await mergeSyncedEntries(
    {
        books: [
            {
                id: "book-1",
                title: "凤凰籽",
                author: "东来",
                year: 2025,
                cover: "/covers/manual.jpg",
                notes: "手工笔记",
            },
        ],
        movies: [],
        series: [
            {
                id: "series-1",
                title: "都是她的错",
                year: 2025,
                country: "美国 / 澳大利亚",
                rating: 10,
                status: "completed",
                addedDate: "2026-02-10",
                cover: "/covers/manual-series.jpg",
            },
        ],
        music: [],
    },
    {
        books: [
            {
                title: "凤凰籽",
                author: "豆瓣作者",
                year: 2025,
                cover: "/covers/douban.jpg",
                notes: "豆瓣短评",
                doubanId: "35166318",
                doubanUrl: "https://book.douban.com/subject/35166318/",
                source: "douban",
            },
        ],
        movies: moviePage.items.map((item) => ({ ...item, cover: "/covers/movie.jpg" })),
        series: translatedMoviePage.items.map((item) => ({ ...item, cover: "/covers/douban-series.jpg" })),
        music: musicPage.items.map((item) => ({ ...item, cover: "/covers/music.jpg" })),
    },
    { coversDir: "/tmp/c0llecti0n-douban-sync-test" },
);

assert.equal(mergeResult.byType.books.updated, 1);
assert.equal(mergeResult.data.books[0].notes, "手工笔记");
assert.equal(mergeResult.data.books[0].cover, "/covers/manual.jpg");
assert.equal(mergeResult.data.books[0].doubanId, "35166318");
assert.equal(mergeResult.byType.movies.added, 1);
assert.equal(mergeResult.data.movies[0].id, "movie-1");
assert.equal(mergeResult.byType.series.updated, 1);
assert.equal(mergeResult.byType.series.added, 0);
assert.equal(mergeResult.data.series.length, 1);
assert.equal(mergeResult.data.series[0].title, "都是她的错");
assert.equal(mergeResult.data.series[0].originalTitle, "All Her Fault");
assert.equal(mergeResult.data.series[0].doubanId, "36778966");
assert.equal(mergeResult.data.series[0].cover, "/covers/manual-series.jpg");
assert.equal(mergeResult.byType.music.added, 1);

const dedupeResult = dedupeCollectionData({
    books: [],
    movies: [],
    series: [
        {
            id: "series-2",
            title: "All Her Fault",
            type: "series",
            year: 2025,
            country: "美国 / 澳大利亚",
            rating: 10,
            status: "completed",
            addedDate: "2026-02-10",
            doubanId: "36778966",
            doubanUrl: "https://movie.douban.com/subject/36778966/",
            source: "douban",
        },
        {
            id: "series-1",
            title: "都是她的错",
            type: "series",
            year: 2025,
            country: "美国 / 澳大利亚",
            rating: 10,
            status: "completed",
            addedDate: "2026-02-10",
        },
    ],
    music: [],
});

assert.equal(dedupeResult.summary.series.removed, 1);
assert.equal(dedupeResult.data.series.length, 1);
assert.equal(dedupeResult.data.series[0].id, "series-1");
assert.equal(dedupeResult.data.series[0].title, "都是她的错");
assert.equal(dedupeResult.data.series[0].doubanId, "36778966");

const aliasDedupeResult = dedupeCollectionData({
    books: [],
    movies: [],
    series: [
        {
            id: "series-2",
            title: "Formula 1:Drive to Survive Season 7",
            type: "series",
            year: 2025,
            country: "美国",
            rating: 8,
            status: "completed",
            addedDate: "2025-04-15",
            doubanId: "37165180",
            doubanUrl: "https://movie.douban.com/subject/37165180/",
            source: "douban",
        },
        {
            id: "series-1",
            title: "Drive To Survive Season 7",
            type: "series",
            country: "美国",
            rating: 7,
            status: "completed",
            addedDate: "2025-04-15",
        },
        {
            id: "series-4",
            title: "ホットスポット",
            type: "series",
            year: 2025,
            country: "日本",
            rating: 10,
            status: "completed",
            addedDate: "2026-01-02",
            doubanId: "36990427",
            doubanUrl: "https://movie.douban.com/subject/36990427/",
            source: "douban",
        },
        {
            id: "series-3",
            title: "热点",
            originalTitle: "ホットスポット",
            type: "series",
            country: "日本",
            rating: 10,
            status: "completed",
            addedDate: "2025-12-12",
        },
    ],
    music: [],
});

assert.equal(aliasDedupeResult.summary.series.removed, 2);
assert.equal(aliasDedupeResult.data.series.length, 2);
assert.equal(aliasDedupeResult.data.series[0].id, "series-1");
assert.equal(aliasDedupeResult.data.series[0].doubanId, "37165180");
assert.equal(aliasDedupeResult.data.series[1].id, "series-3");
assert.equal(aliasDedupeResult.data.series[1].title, "热点");
assert.equal(aliasDedupeResult.data.series[1].doubanId, "36990427");

const statusScopedDedupeResult = dedupeCollectionData({
    books: [],
    movies: [],
    series: [
        {
            id: "series-3",
            title: "Formula 1: Drive to Survive",
            type: "series",
            year: 2026,
            country: "英国",
            status: "want-to-watch",
            doubanId: "37502429",
            source: "douban",
        },
        {
            id: "series-2",
            title: "Formula 1:Drive to Survive Season 7",
            type: "series",
            year: 2025,
            country: "美国",
            status: "completed",
            doubanId: "37165180",
            source: "douban",
        },
        {
            id: "series-1",
            title: "Drive To Survive Season 7",
            originalTitle: "Formula 1:Drive to Survive Season 7",
            type: "series",
            country: "美国",
            status: "completed",
        },
    ],
    music: [],
});

assert.equal(statusScopedDedupeResult.summary.series.removed, 1);
assert.equal(statusScopedDedupeResult.data.series.length, 2);
assert.equal(statusScopedDedupeResult.data.series[0].id, "series-3");
assert.equal(statusScopedDedupeResult.data.series[1].id, "series-1");
assert.equal(statusScopedDedupeResult.data.series[1].doubanId, "37165180");

const coverDedupeResult = dedupeCollectionData({
    books: [],
    movies: [
        {
            id: "movie-1",
            title: "昨日青春",
            type: "movie",
            country: "日本 / 美国",
            rating: 8,
            status: "completed",
            cover: "/covers/p2912425407.jpg",
        },
        {
            id: "movie-2",
            title: "Happyend",
            type: "movie",
            country: "日本 / 美国",
            rating: 8,
            status: "completed",
            cover: "https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2912425407.jpg",
            doubanId: "36960439",
            doubanUrl: "https://movie.douban.com/subject/36960439/",
            source: "douban",
        },
    ],
    series: [],
    music: [],
});

assert.equal(coverDedupeResult.summary.movies.removed, 1);
assert.equal(coverDedupeResult.data.movies.length, 1);
assert.equal(coverDedupeResult.data.movies[0].id, "movie-1");
assert.equal(coverDedupeResult.data.movies[0].doubanId, "36960439");

const bookEditionDedupeResult = dedupeCollectionData({
    books: [
        {
            id: "book-2",
            title: "克拉拉与太阳",
            author: "[英] 石黑一雄 / 宋佥",
            year: 2021,
            status: "completed",
            doubanId: "35315153",
            doubanUrl: "https://book.douban.com/subject/35315153/",
            source: "douban",
        },
        {
            id: "book-1",
            title: "克拉拉与太阳",
            author: "石黑一雄",
            year: 2023,
            status: "completed",
            cover: "/covers/manual-book.jpg",
        },
    ],
    movies: [],
    series: [],
    music: [],
});

assert.equal(bookEditionDedupeResult.summary.books.removed, 1);
assert.equal(bookEditionDedupeResult.data.books.length, 1);
assert.equal(bookEditionDedupeResult.data.books[0].id, "book-1");
assert.equal(bookEditionDedupeResult.data.books[0].doubanId, "35315153");
assert.equal(bookEditionDedupeResult.data.books[0].cover, "/covers/manual-book.jpg");

const bookSeriesSuffixDedupeResult = dedupeCollectionData({
    books: [
        {
            id: "book-2",
            title: "错误、边缘、野马（读库文存·他说）",
            author: "读库 编选",
            year: 2024,
            status: "completed",
            doubanId: "36820858",
            doubanUrl: "https://book.douban.com/subject/36820858/",
            source: "douban",
        },
        {
            id: "book-1",
            title: "错误、边缘、野马",
            author: "读库 编选",
            year: 2024,
            status: "completed",
            cover: "/covers/manual-book.jpg",
        },
    ],
    movies: [],
    series: [],
    music: [],
});

assert.equal(bookSeriesSuffixDedupeResult.summary.books.removed, 1);
assert.equal(bookSeriesSuffixDedupeResult.data.books.length, 1);
assert.equal(bookSeriesSuffixDedupeResult.data.books[0].id, "book-1");
assert.equal(bookSeriesSuffixDedupeResult.data.books[0].title, "错误、边缘、野马");
assert.equal(bookSeriesSuffixDedupeResult.data.books[0].originalTitle, "错误、边缘、野马（读库文存·他说）");
assert.equal(bookSeriesSuffixDedupeResult.data.books[0].doubanId, "36820858");
assert.equal(bookSeriesSuffixDedupeResult.data.books[0].cover, "/covers/manual-book.jpg");

const crossTypeDedupeResult = dedupeCollectionData({
    books: [],
    movies: [
        {
            id: "movie-1",
            title: "东京大饭店·特别篇",
            originalTitle: "グランメゾン東京 スペシャル",
            type: "movie",
            country: "日本",
            rating: 10,
            status: "completed",
            addedDate: "2025-03-03",
            cover: "/covers/p2917218288.jpg",
        },
    ],
    series: [
        {
            id: "series-1",
            title: "グランメゾン東京 スペシャル",
            type: "series",
            year: 2024,
            country: "日本",
            rating: 10,
            status: "completed",
            addedDate: "2025-03-03",
            cover: "https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2917218288.jpg",
            doubanId: "37077071",
            doubanUrl: "https://movie.douban.com/subject/37077071/",
            source: "douban",
        },
    ],
    music: [],
});

assert.equal(crossTypeDedupeResult.summary.movies.removed, 0);
assert.equal(crossTypeDedupeResult.summary.series.removed, 1);
assert.equal(crossTypeDedupeResult.data.movies.length, 1);
assert.equal(crossTypeDedupeResult.data.series.length, 0);
assert.equal(crossTypeDedupeResult.data.movies[0].title, "东京大饭店·特别篇");
assert.equal(crossTypeDedupeResult.data.movies[0].doubanId, "37077071");

console.log("douban sync parser and merge tests passed");
