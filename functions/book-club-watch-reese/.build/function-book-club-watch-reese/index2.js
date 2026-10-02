import { z } from "zod";
//#region src/lib/book-club-watch/model.ts
var TIMEZONE = "America/New_York";
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
function easternDate(now) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: TIMEZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		weekday: "short"
	}).formatToParts(now);
	const part = (type) => parts.find((item) => item.type === type).value;
	return {
		month: `${part("year")}-${part("month")}`,
		day: Number(part("day")),
		weekday: part("weekday")
	};
}
function inWindow(club, now) {
	const { day, weekday } = easternDate(now);
	if (club === "reese") return day <= 8;
	if (club === "read-with-jenna") return day <= 8 && ["Mon", "Tue"].includes(weekday);
	return (club === "gma" ? ["Tue"] : [
		"Mon",
		"Wed",
		"Fri"
	]).includes(weekday);
}
z.object({
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
//#endregion
export { CLUBS, TIMEZONE, easternDate, inWindow, normalize, reference };

//# sourceMappingURL=index2.js.map