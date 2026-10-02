import { CLUBS, normalize } from "./index2.js";
import { parseReeseSourcePage } from "./index3.js";
import { parseJennaPicks } from "./index4.js";
import * as cheerio from "cheerio";
//#region src/lib/book-club-watch/sources.ts
var clean = (s) => s.replace(/\s+/g, " ").trim();
var months = "January February March April May June July August September October November December".split(" ");
function selectionMonth(text) {
	const iso = text.match(/\b(20\d{2})-(0[1-9]|1[0-2])(?:-\d{2})?\b/);
	if (iso) return `${iso[1]}-${iso[2]}`;
	const date = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:\d{1,2},?\s+)?(20\d{2})\b/i);
	return date ? `${date[2]}-${String(months.findIndex((m) => m.toLowerCase() === date[1].toLowerCase()) + 1).padStart(2, "0")}` : void 0;
}
function parseReesePage(html, sourceUrl = CLUBS.reese.sourceUrl) {
	const page = parseReeseSourcePage(html, sourceUrl);
	return {
		next: page.next,
		picks: page.picks.map((pick) => {
			const month = selectionMonth(pick.selectionDate || "");
			if (!month || !pick.authors.length) throw new Error("Reese source: a selection is missing its month or author.");
			return {
				...pick,
				selectionMonth: month,
				selectionDate: month,
				evidence: `${pick.selectionDate}: ${pick.title} by ${pick.authors.join(", ")}`
			};
		})
	};
}
function parseGma(html) {
	const $ = cheerio.load(html), picks = [];
	let month;
	$("h2,h3,h4").each((_, el) => {
		const text = clean($(el).text());
		if (/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}$/i.test(text)) {
			month = selectionMonth(text);
			return;
		}
		if (!month) return;
		const match = text.match(/^(.+?)\s+by\s+(.+)$/i);
		if (!match) return;
		picks.push({
			title: match[1].replace(/:?\s*A GMA Book Club Pick/i, "").trim(),
			authors: [match[2]],
			selectionMonth: month,
			sourceUrl: CLUBS.gma.sourceUrl,
			evidence: `${month}: ${text}`
		});
	});
	return picks;
}
function oprahAnnouncementUrl(html) {
	const $ = cheerio.load(html);
	const links = $("a[href]").toArray();
	let link = links.find((el) => /latest pick:/i.test($(el).text()));
	if (!link) {
		const title = $("h2,h3").toArray().map((el) => clean($(el).text()).match(/^(.+?),?\s+by\s+(.+)$/i)).find(Boolean)?.[1].replace(/,$/, "");
		link = title ? links.find((el) => {
			const text = clean($(el).text());
			return /book club pick/i.test(text) && normalize(text).includes(normalize(title)) && /\/a\d+\//.test($(el).attr("href") || "");
		}) : void 0;
	}
	if (!link) throw new Error("Oprah source: latest-pick announcement link not found.");
	return new URL($(link).attr("href"), CLUBS.oprah.sourceUrl).href;
}
function parseOprahAnnouncement(html, url) {
	const $ = cheerio.load(html);
	const date = $("meta[property=\"article:published_time\"]").attr("content") || $("time[datetime]").first().attr("datetime");
	const month = date && selectionMonth(date);
	const headline = clean($("h1").first().text());
	const pair = [
		headline,
		$("meta[name=\"description\"]").attr("content") || "",
		...$("article p").slice(0, 8).toArray().map((el) => clean($(el).text()))
	].map((text) => text.match(/[“"‘']([^”"’']+)[”"’']\s*(?:,?\s*by)\s+([\p{L}][\p{L} .’'-]+?)(?:[,.!]|\s+(?:is|as|for|was|and)\b|$)/u)).find(Boolean);
	const productPairs = $("a").toArray().map((el) => clean($(el).text()).match(/^(.+?),?\s+by\s+(.+)$/i)).filter((match) => match && normalize(headline).includes(normalize(match[1])));
	const verified = pair ? [{
		title: pair[1],
		author: pair[2]
	}] : productPairs.map((match) => ({
		title: match[1].replace(/,$/, ""),
		author: match[2]
	}));
	if (!month || !verified.length) throw new Error("Oprah source: could not verify announcement date, quoted title, and author. Inspect the official article.");
	return [...new Map(verified.map((p) => [normalize(p.title), {
		title: p.title,
		authors: [p.author.trim()],
		selectionMonth: month,
		selectionDate: date.slice(0, 10),
		sourceUrl: url,
		evidence: `${date}: ${p.title} by ${p.author}`
	}])).values()];
}
async function fetchOfficialHtml(url, fetcher = fetch) {
	const allowed = /* @__PURE__ */ new Set([
		"reesesbookclub.com",
		"www.today.com",
		"www.goodmorningamerica.com",
		"www.oprahdaily.com"
	]);
	let target = url;
	for (let redirect = 0; redirect < 4; redirect++) {
		const parsed = new URL(target);
		if (parsed.protocol !== "https:" || !allowed.has(parsed.hostname)) throw new Error("Source URL is outside the official allowlist.");
		const response = await fetcher(target, {
			redirect: "manual",
			signal: AbortSignal.timeout(2e4),
			headers: { "User-Agent": "Everlogue-BookClubWatch/1.0" },
			cache: "no-store"
		});
		if ([
			301,
			302,
			303,
			307,
			308
		].includes(response.status)) {
			target = new URL(response.headers.get("location") || "", target).href;
			continue;
		}
		if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}.`);
		const text = await response.text();
		if (text.length > 1e7) throw new Error("Official source response exceeded the size limit.");
		return text;
	}
	throw new Error("Official source redirected too many times.");
}
async function discoverPicks(club, month, getHtml = fetchOfficialHtml) {
	const url = CLUBS[club].sourceUrl;
	const html = await getHtml(url);
	let picks;
	if (club === "reese") picks = parseReesePage(html).picks;
	else if (club === "gma") picks = parseGma(html);
	else if (club === "read-with-jenna") picks = parseJennaPicks(html).filter((p) => selectionMonth(p.selectionDate || "") === month).map((p) => {
		const month = selectionMonth(p.selectionDate || "");
		if (!month || !p.authors.length) throw new Error("Jenna source: missing selection date or author.");
		return {
			title: p.title,
			authors: p.authors,
			selectionMonth: month,
			sourceUrl: url,
			evidence: `${p.selectionDate}: ${p.title} by ${p.authors.join(", ")}`,
			...p.isbn?.length === 13 ? { isbn13: p.isbn } : {}
		};
	});
	else {
		const announcement = oprahAnnouncementUrl(html);
		picks = parseOprahAnnouncement(await getHtml(announcement), announcement);
	}
	if (!picks.length && !(club === "read-with-jenna" && parseJennaPicks(html).length)) throw new Error("Source structure not recognized: no verified selections found.");
	return club === "oprah" ? picks : picks.filter((p) => p.selectionMonth === month);
}
//#endregion
export { clean, discoverPicks, fetchOfficialHtml, oprahAnnouncementUrl, parseGma, parseOprahAnnouncement, parseReesePage, selectionMonth };

//# sourceMappingURL=index5.js.map