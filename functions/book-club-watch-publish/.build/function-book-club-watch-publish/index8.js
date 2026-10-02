import { z } from "zod";
//#region src/lib/validation.ts
var HALF_STARS = [
	.5,
	1,
	1.5,
	2,
	2.5,
	3,
	3.5,
	4,
	4.5,
	5
];
z.number().refine((value) => HALF_STARS.includes(value), { message: "Rating must be between 0.5 and 5 in half-star increments" });
z.string().trim().min(1).max(120);
z.string().trim().min(1).max(8e3);
z.enum(["private", "public"]);
z.enum([
	"wantToRead",
	"currentlyReading",
	"finished",
	"custom"
]);
z.enum([
	"wantToRead",
	"currentlyReading",
	"finished"
]);
z.discriminatedUnion("source", [z.object({
	source: z.literal("catalog"),
	id: z.string().trim().min(1)
}), z.object({
	source: z.literal("googleBooks"),
	id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/)
})]);
z.enum([
	"proposed",
	"needsReview",
	"approved",
	"rejected"
]);
z.enum([
	"cloud",
	"blush",
	"violet",
	"clay",
	"apricot",
	"butter",
	"mint",
	"sky",
	"navy",
	"periwinkle",
	"sage",
	"peach",
	"rose",
	"lilac",
	"sand",
	"slate"
]);
function slugify(value) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 96);
}
//#endregion
export { HALF_STARS, slugify };

//# sourceMappingURL=index8.js.map