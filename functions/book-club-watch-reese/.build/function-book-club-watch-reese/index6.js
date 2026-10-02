//#region src/lib/google-books.ts
function secureImageUrl(url) {
	return url ? url.replace(/^http:\/\//, "https://") : void 0;
}
function coverSrc(book) {
	const images = book.volumeInfo?.imageLinks;
	const url = secureImageUrl(images?.extraLarge || images?.large || images?.medium || images?.small || images?.thumbnail || images?.smallThumbnail);
	return url ? url.replace(/zoom=\d/, "zoom=3").replace(/&edge=curl/, "") : url;
}
function plainText(html) {
	if (!html) return "";
	return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();
}
//#endregion
export { coverSrc, plainText, secureImageUrl };

//# sourceMappingURL=index6.js.map