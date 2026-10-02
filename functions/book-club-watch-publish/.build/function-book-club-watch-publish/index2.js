import { z } from "zod";
//#region src/lib/book-club-watch/model.ts
var CLUBS = {
	reese: {
		name: "Reese's Book Club",
		collectionId: "curatedCollection.reeses-book-club",
		sourceUrl: "https://reesesbookclub.com/the-complete-list/",
		schedule: "0 9 1-8 * *"
	},
	gma: {
		name: "GMA Book Club",
		collectionId: "curatedCollection.gma-book-club",
		sourceUrl: "https://www.goodmorningamerica.com/news/story/shop-gma-book-club-picks-list--81520726",
		schedule: "0 10 * * 2"
	},
	"read-with-jenna": {
		name: "Today / Read With Jenna",
		collectionId: "curatedCollection.read-with-jenna",
		sourceUrl: "https://www.today.com/shop/read-jenna-book-club-list-today-s-jenna-bush-hager-t164652",
		schedule: "0 9 * * 1,2"
	},
	oprah: {
		name: "Oprah's Book Club",
		collectionId: "curatedCollection.oprahs-book-club",
		sourceUrl: "https://www.oprahdaily.com/entertainment/books/g23067476/oprah-book-club-list/",
		schedule: "0 9 * * 1,3,5"
	}
};
var reference = (_ref) => ({
	_type: "reference",
	_ref
});
var normalize = (value) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
var metadataSchema = z.object({
	title: z.string(),
	authors: z.array(z.string()),
	description: z.string().optional(),
	coverUrl: z.string().url().refine((url) => url.startsWith("https://")).optional(),
	isbn13: z.string().optional(),
	isbn10: z.string().optional(),
	googleBooksId: z.string().optional(),
	publisher: z.string().optional(),
	publishedDate: z.string().optional(),
	language: z.string().optional(),
	pageCount: z.number().int().positive().optional()
});
function approvalFor(doc) {
	const title = (doc.reviewedTitle || doc.discoveredTitle).trim();
	const authors = (doc.reviewedAuthors || doc.discoveredAuthors || []).map((s) => s.trim()).filter(Boolean);
	if (!title || !authors.length || !/^\d{4}-(0[1-9]|1[0-2])$/.test(doc.selectionMonth)) throw new Error("Title, authors, and a valid selection month are required.");
	if (doc.selectionDate && (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(doc.selectionDate) || !doc.selectionDate.startsWith(doc.selectionMonth))) throw new Error("Selection date must match the selection month.");
	if (!doc.publicationMode) throw new Error("Choose an existing book or explicitly choose to create a new book.");
	if (doc.publicationMode === "existing" && !doc.matchedBook?._ref) throw new Error("Choose the existing book to publish.");
	const metadata = doc.proposedMetadata ? metadataSchema.parse({
		...doc.proposedMetadata,
		title,
		authors
	}) : void 0;
	return {
		title,
		authors,
		selectionMonth: doc.selectionMonth,
		mode: doc.publicationMode,
		...doc.selectionDate ? { selectionDate: doc.selectionDate } : {},
		...doc.matchedBook ? { matchedBook: doc.matchedBook } : {},
		...metadata ? { metadata } : {}
	};
}
//#endregion
export { CLUBS, approvalFor, normalize, reference };

//# sourceMappingURL=index2.js.map