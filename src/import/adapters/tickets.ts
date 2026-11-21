import type { SupportTicket, TicketComment } from "../../model/types.ts";
import type { Adapter, AdapterContext } from "../adapter.ts";
import { timestamp } from "../parseDate.ts";
import { asArray, body, isRecord, known, text } from "../read.ts";

function readComments(
	value: unknown,
	context: AdapterContext,
): TicketComment[] {
	const comments: TicketComment[] = [];

	for (const row of asArray(value)) {
		// 本文の無いやりとりは表示する意味が無いので捨てる
		const commentText = isRecord(row) ? body(row.comment) : null;
		if (!isRecord(row) || commentText === null) {
			context.skip();
			continue;
		}

		comments.push({
			author: known(row.author),
			at: timestamp(row.create_datetime),
			text: commentText,
		});
	}

	return comments;
}

/** `zendesk/zendesk_tickets.json` */
export const tickets: Adapter = (json, context) => {
	const result: SupportTicket[] = [];
	if (!isRecord(json)) {
		return { tickets: result };
	}

	// 最上位はチケット ID をキーにしたオブジェクト
	for (const [key, ticket] of Object.entries(json)) {
		if (!isRecord(ticket)) {
			context.skip();
			continue;
		}

		result.push({
			id: text(ticket.ticket_id) ?? key,
			subject: text(ticket.subject),
			status: known(ticket.status),
			createdAt: timestamp(ticket.create_datetime),
			comments: readComments(ticket.comments, context),
		});
	}

	return { tickets: result };
};
