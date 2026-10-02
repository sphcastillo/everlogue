import { watchClient } from "./index7.js";
import { publishDiscovery } from "./index9.js";
import { documentEventHandler } from "@sanity/functions";
//#region functions/book-club-watch-publish/index.ts
var handler = documentEventHandler(async ({ context, event }) => {
	if (context.local || process.env.WATCH_ENABLED !== "true") {
		console.log("Book Club Watch publication disabled; no mutations performed.");
		return;
	}
	await publishDiscovery(watchClient(context.clientOptions.token), event.data._id);
});
//#endregion
export { handler };

//# sourceMappingURL=index.js.map