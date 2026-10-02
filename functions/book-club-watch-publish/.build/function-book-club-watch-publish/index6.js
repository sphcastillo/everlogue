import { normalize } from "./index2.js";
import "./index5.js";
import { createHash } from "node:crypto";
//#region src/lib/book-club-watch/service.ts
var hash = (s) => createHash("sha256").update(s).digest("hex");
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
//#endregion
export { conflict, findBook, hash, safeError };

//# sourceMappingURL=index6.js.map