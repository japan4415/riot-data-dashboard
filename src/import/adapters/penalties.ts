import type { Penalty } from "../../model/types.ts";
import type { Adapter } from "../adapter.ts";
import { timestamp } from "../parseDate.ts";
import { asArray, bool, isRecord, known } from "../read.ts";

/** `penalties/penalty_history.json` */
export const penalties: Adapter = (json, context) => {
	const result: Penalty[] = [];

	for (const row of asArray(json)) {
		if (!isRecord(row)) {
			context.skip();
			continue;
		}

		// 日時が読めなくても、ペナルティがあった事実は残す
		result.push({
			at: timestamp(row.date_issued),
			scope: known(row.scope),
			restrictionType: known(row.restriction_type),
			reason: known(row.restriction_reason),
			sentence: known(row.sentence),
			status: known(row.status),
			isManual: bool(row.is_manual),
		});
	}

	return { penalties: result };
};
