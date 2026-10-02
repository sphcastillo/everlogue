import "./index2.js";
import "./index5.js";
import "./index6.js";
import { createClient } from "@sanity/client";
//#region src/lib/book-club-watch/runtime.ts
function watchClient(token) {
	const projectId = process.env.WATCH_PROJECT_ID, dataset = process.env.WATCH_DATASET;
	if (!projectId || !dataset || !token) throw new Error("Watch requires an explicit project, dataset, and robot token.");
	return createClient({
		projectId,
		dataset,
		token,
		apiVersion: "2026-09-01",
		useCdn: false,
		perspective: "raw"
	});
}
//#endregion
export { watchClient };

//# sourceMappingURL=index7.js.map