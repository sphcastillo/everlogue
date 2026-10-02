import { CLUBS, easternDate, inWindow, normalize, reference } from "./index2.js";
import { discoverPicks } from "./index5.js";
import { coverSrc, plainText } from "./index6.js";
import { createHash, randomUUID } from "node:crypto";
//#region src/lib/book-club-watch/service.ts
var hash = (s) => createHash("sha256").update(s).digest("hex");
var identityFor = (club, pick) => hash([
	club,
	pick.selectionMonth,
	normalize(pick.title),
	...pick.authors.map(normalize).sort()
].join("\n"));
var conflict = (e) => Boolean(e && typeof e === "object" && "statusCode" in e && e.statusCode === 409);
function safeError(error) {
	if (error instanceof Error && /^(Official source|Source |Reese source|Jenna source|Oprah source|Google Books|Publication |Watch )/.test(error.message)) return error.message.slice(0, 600);
	return "Watch operation failed. Inspect function logs or retry; no credentials are stored in this record.";
}
var fresh = { useCdn: false };
async function findBook(client, title, authors, metadata) {
	const identifierMatch = `(
    ($isbn13 != "" && (isbn13 == $isbn13 || _id in *[_type == "edition" && isbn13 == $isbn13 && !(_id in path("drafts.**"))].book._ref)) ||
    ($isbn10 != "" && (isbn10 == $isbn10 || _id in *[_type == "edition" && isbn10 == $isbn10 && !(_id in path("drafts.**"))].book._ref)) ||
    ($googleId != "" && (googleBooksId == $googleId || _id in *[_type == "edition" && googleBooksId == $googleId && !(_id in path("drafts.**"))].book._ref))
  )`;
	const candidates = await client.fetch(`*[_type == "book" && !(_id in path("drafts.**")) && (
      ${identifierMatch} || lower(title) == lower($title) || count(authors[lower(@) in $authors]) > 0
    )]{_id,title,authors,isbn13,"identifierMatch": ${identifierMatch}}`, {
		title,
		authors: authors.map((a) => a.toLowerCase()),
		isbn13: metadata?.isbn13 || "",
		isbn10: metadata?.isbn10 || "",
		googleId: metadata?.googleBooksId || ""
	}, fresh);
	const identified = candidates.filter((book) => book.identifierMatch);
	if (identified.length === 1) return identified[0];
	if (identified.length > 1) return void 0;
	const exact = candidates.filter((book) => normalize(book.title) === normalize(title) && authors.some((author) => book.authors?.some((other) => normalize(author) === normalize(other))));
	return exact.length === 1 ? exact[0] : void 0;
}
async function enrich(client, doc, fetcher = fetch) {
	const existing = await findBook(client, doc.discoveredTitle, doc.discoveredAuthors, { isbn13: doc.isbn13 });
	if (existing) return {
		matchedBook: reference(existing._id),
		matchConfidence: existing.identifierMatch ? 1 : .98,
		matchExplanation: "Unique catalog match by identifier or normalized title and author; score is a rule-based rank, not a probability."
	};
	const key = process.env.GOOGLE_BOOKS_API_KEY;
	if (!key) throw new Error("Google Books enrichment is not configured; review the official source manually.");
	const query = `intitle:${doc.discoveredTitle} inauthor:${doc.discoveredAuthors[0]}`;
	const response = await fetcher(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`, {
		headers: { "x-goog-api-key": key },
		signal: AbortSignal.timeout(15e3)
	});
	if (!response.ok) throw new Error(`Google Books enrichment returned HTTP ${response.status}.`);
	const { items = [] } = await response.json();
	const candidate = items.map((book) => {
		const info = book.volumeInfo;
		const title = normalize(info?.title || "") === normalize(doc.discoveredTitle);
		const author = doc.discoveredAuthors.some((a) => info?.authors?.some((b) => normalize(a) === normalize(b)));
		return {
			book,
			score: title && author ? .98 : title ? .6 : .2
		};
	}).sort((a, b) => b.score - a.score)[0];
	if (!candidate) throw new Error("Google Books returned no metadata candidates.");
	const info = candidate.book.volumeInfo;
	return {
		proposedMetadata: Object.fromEntries(Object.entries({
			title: info.title || doc.discoveredTitle,
			authors: info.authors || [],
			googleBooksId: candidate.book.id,
			description: plainText(info.description),
			coverUrl: coverSrc(candidate.book),
			isbn13: info.industryIdentifiers?.find((id) => id.type === "ISBN_13")?.identifier,
			isbn10: info.industryIdentifiers?.find((id) => id.type === "ISBN_10")?.identifier,
			publisher: info.publisher,
			publishedDate: info.publishedDate,
			pageCount: info.pageCount,
			language: info.language
		}).filter(([, value]) => value !== void 0)),
		matchConfidence: candidate.score,
		matchExplanation: candidate.score >= .98 ? "Provider title and author match; editor must confirm the edition." : "Weak provider suggestion. Verify all metadata before approving a new book."
	};
}
async function persistDiscovery(client, club, pick, now) {
	const identity = identityFor(club, pick);
	const find = () => client.fetch(`*[_type == "bookClubDiscovery" && identity == $identity && !(_id in path("drafts.**"))][0]`, { identity }, fresh);
	let doc = await find();
	if (doc) return doc;
	try {
		await client.transaction().create({
			_id: `bookClubWatchIdentity.${identity}`,
			_type: "catalogImportIdentity",
			importKey: identity
		}).create({
			_type: "bookClubDiscovery",
			identity,
			bookClub: club,
			status: "discovered",
			selectionMonth: pick.selectionMonth,
			...pick.selectionDate ? { selectionDate: pick.selectionDate } : {},
			discoveredTitle: pick.title,
			discoveredAuthor: pick.authors.join(", "),
			discoveredAuthors: pick.authors,
			discoveredAt: now.toISOString(),
			sourceUrl: pick.sourceUrl,
			sourceName: CLUBS[club].name,
			sourceEvidence: pick.evidence,
			...pick.isbn13 ? { isbn13: pick.isbn13 } : {}
		}).commit({ visibility: "sync" });
	} catch (error) {
		if (!conflict(error)) throw error;
	}
	doc = await find();
	if (!doc) throw new Error("Watch discovery could not be resolved after creation.");
	return doc;
}
async function finishEnrichment(client, doc, enrichDoc = enrich) {
	if (doc.status !== "discovered") return;
	let fields;
	try {
		fields = await enrichDoc(client, doc);
	} catch (error) {
		fields = {
			enrichmentError: safeError(error),
			matchExplanation: "Enrichment unavailable; manual review required."
		};
	}
	try {
		await client.patch(doc._id).ifRevisionId(doc._rev).set({
			...fields,
			status: "needs_review"
		}).commit({ visibility: "sync" });
	} catch (error) {
		if (!conflict(error)) throw error;
	}
}
async function runWatch(client, club, options = {}) {
	const now = options.now || /* @__PURE__ */ new Date(), month = easternDate(now).month;
	const run = await client.create({
		_type: "bookClubWatchRun",
		bookClub: club,
		invocationId: options.invocationId || randomUUID(),
		startedAt: now.toISOString(),
		outcome: "running",
		sourceUrl: CLUBS[club].sourceUrl
	}, { visibility: "sync" });
	const ids = [];
	const finish = async (outcome, reason) => {
		await client.patch(run._id).set({
			outcome,
			reason,
			finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
			discoveries: [...new Set(ids)].map((id) => ({
				...reference(id),
				_key: id
			}))
		}).commit({ visibility: "sync" });
		return {
			outcome,
			reason,
			discoveryIds: [...new Set(ids)]
		};
	};
	try {
		if (options.enabled === false) return await finish("skipped", "Watch is disabled until rollout validation is complete.");
		if (!inWindow(club, now)) return await finish("skipped", "Outside the club’s Eastern calendar window.");
		const pending = await client.fetch(`*[_type == "bookClubDiscovery" && bookClub == $club && status == "discovered" && !(_id in path("drafts.**"))]`, { club }, fresh);
		for (const doc of pending) {
			ids.push(doc._id);
			await finishEnrichment(client, doc, options.enrich);
		}
		if (club !== "oprah") {
			const recorded = await client.fetch(`count(*[_type == "bookClubDiscovery" && bookClub == $club && selectionMonth == $month && status in ["discovered","needs_review","approved","published"] && !(_id in path("drafts.**"))]) > 0 || count(*[_id == $collection][0].books[selectionDate match ($month + "*") || (year == $year && lower(month) == $monthName)]) > 0`, {
				club,
				month,
				collection: CLUBS[club].collectionId,
				year: Number(month.slice(0, 4)),
				monthName: new Intl.DateTimeFormat("en-US", {
					month: "long",
					timeZone: "UTC"
				}).format(/* @__PURE__ */ new Date(`${month}-15T12:00:00Z`)).toLowerCase()
			}, fresh);
			const interrupted = await client.fetch("*[_type == \"bookClubWatchRun\" && bookClub == $club && _id != $runId && startedAt >= $since] | order(startedAt desc)[0].outcome in [\"running\", \"failed\"]", {
				club,
				runId: run._id,
				since: `${month}-01T00:00:00Z`
			}, fresh);
			if (recorded && !interrupted) return await finish("already_recorded", "This month already has a selection or active discovery.");
		}
		const picks = await (options.discover || discoverPicks)(club, month);
		const toEnrich = [];
		for (const pick of picks) {
			const existing = await findBook(client, pick.title, pick.authors, { isbn13: pick.isbn13 });
			if (existing && await client.fetch("count(*[_id == $collection][0].books[book._ref == $book]) > 0", {
				collection: CLUBS[club].collectionId,
				book: existing._id
			}, fresh)) continue;
			const doc = await persistDiscovery(client, club, pick, now);
			if (doc.status === "rejected" || doc.status === "published") continue;
			ids.push(doc._id);
			toEnrich.push(doc);
		}
		for (const doc of toEnrich) await finishEnrichment(client, doc, options.enrich);
		return await finish(ids.length ? "discovered" : "no_change", ids.length ? "Selections are available for editorial review." : "No new eligible selections found.");
	} catch (error) {
		return await finish("failed", safeError(error));
	}
}
//#endregion
export { conflict, enrich, findBook, finishEnrichment, hash, identityFor, persistDiscovery, runWatch, safeError };

//# sourceMappingURL=index7.js.map