import { easternDate } from "./index2.js";
import { discoverPicks } from "./index5.js";
import { runWatch } from "./index7.js";
import { createClient } from "@sanity/client";
import { scheduledEventHandler } from "@sanity/functions";
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
function scheduledWatch(club) {
	return scheduledEventHandler(async ({ context }) => {
		if (context.local) {
			console.log(JSON.stringify(await discoverPicks(club, easternDate(/* @__PURE__ */ new Date()).month)));
			return;
		}
		const result = await runWatch(watchClient(context.clientOptions?.token), club, { enabled: process.env.WATCH_ENABLED === "true" });
		console.log(JSON.stringify({
			club,
			...result
		}));
		if (result.outcome === "failed") throw new Error(result.reason);
	});
}
//#endregion
export { scheduledWatch, watchClient };

//# sourceMappingURL=index8.js.map