import { type PointerEvent, useMemo, useRef } from "react";
import {
	ACTIVITY_GROUPS,
	type DayActivity,
	levelOf,
} from "../../analysis/activity.ts";
import {
	type DayKey,
	dayKeyFromNumber,
	dayKeyOf,
	dayNumber,
	weekdayOfDay,
} from "../../analysis/localTime.ts";
import {
	ACTIVITY_GROUP_COLORS,
	ACTIVITY_GROUP_LABELS,
	LEVEL_COLORS,
	WEEKDAY_LABELS,
} from "../../labels/activity.ts";
import { formatDay, formatNumber } from "../../labels/format.ts";
import { useElementWidth } from "../useElementWidth.ts";
import { useFontScale } from "../useFontScale.ts";
import styles from "./CalendarHeatmap.module.css";
import { ChartTooltip, TooltipRow, TooltipTitle } from "./ChartTooltip.tsx";
import { useChartTooltip } from "./useChartTooltip.ts";

const LABEL_WIDTH = 26;
const HEADER_HEIGHT = 18;
const MIN_STEP = 9;
const MAX_STEP = 16;
/** 曜日の見出しを出す行。月、水、金。 */
const LABELED_WEEKDAYS = [1, 3, 5];

interface Cell {
	day: DayKey;
	week: number;
	weekday: number;
	level: number;
}

interface CalendarHeatmapProps {
	year: number;
	/** 記録があった日。無い日は「記録なし」として描く。 */
	days: ReadonlyMap<DayKey, DayActivity>;
	/** 濃淡の段階を分ける境界。複数の年を並べるときは、同じ境界を渡して比べられるようにする。 */
	thresholds: readonly number[];
}

/**
 * 1 年分の活動カレンダー。列が週（日曜始まり）、行が曜日。
 * 色の濃さで、その日のログインと試合の回数を表す。
 */
export function CalendarHeatmap({
	year,
	days,
	thresholds,
}: CalendarHeatmapProps) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const width = useElementWidth(wrapperRef, 760);
	const fontScale = useFontScale();
	const labelWidth = Math.round(LABEL_WIDTH * fontScale);
	const headerHeight = Math.round(HEADER_HEIGHT * fontScale);
	const { containerRef, tip, showAt, hide } = useChartTooltip<DayKey>();

	const { cells, weeks, months, activeDays } = useMemo(() => {
		const first = dayKeyOf({ year, month: 1, day: 1 });
		const firstNumber = dayNumber(first);
		const firstWeekday = weekdayOfDay(first);
		const dayCount =
			dayNumber(dayKeyOf({ year: year + 1, month: 1, day: 1 })) - firstNumber;

		const cells: Cell[] = [];
		let activeDays = 0;
		for (let offset = 0; offset < dayCount; offset += 1) {
			const day = dayKeyFromNumber(firstNumber + offset);
			const activity = days.get(day);
			if (activity) {
				activeDays += 1;
			}
			cells.push({
				day,
				week: Math.floor((firstWeekday + offset) / 7),
				weekday: (firstWeekday + offset) % 7,
				level: activity ? levelOf(activity.count, thresholds, true) : 0,
			});
		}

		const months = Array.from({ length: 12 }, (_, index) => {
			const offset =
				dayNumber(dayKeyOf({ year, month: index + 1, day: 1 })) - firstNumber;
			return {
				month: index + 1,
				week: Math.floor((firstWeekday + offset) / 7),
			};
		});

		return {
			cells,
			weeks: Math.ceil((firstWeekday + dayCount) / 7),
			months,
			activeDays,
		};
	}, [year, days, thresholds]);

	// 表示幅に合わせてマスの大きさを決める。小さくなりすぎる場合は横にスクロールさせる
	const step = Math.min(
		MAX_STEP,
		Math.max(MIN_STEP, Math.floor((width - labelWidth) / weeks)),
	);
	const gap = step >= 13 ? 3 : 2;
	const size = step - gap;
	const svgWidth = labelWidth + weeks * step;
	const svgHeight = headerHeight + 7 * step;

	function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
		const day = (event.target as Element).getAttribute?.("data-day");
		if (day) {
			showAt(event.clientX, event.clientY, Number(day));
		} else {
			hide();
		}
	}

	return (
		<div ref={containerRef} className={styles.container}>
			<div ref={wrapperRef} className={styles.scroll}>
				<svg
					className={styles.svg}
					width={svgWidth}
					height={svgHeight}
					role="img"
					aria-label={`${year} 年の活動カレンダー。活動した日は ${formatNumber(activeDays)} 日。日ごとの値は、表の表示で確かめられます。`}
					onPointerMove={handlePointerMove}
					onPointerLeave={hide}
				>
					{months.map(({ month, week }) => (
						<text
							key={month}
							className={styles.label}
							x={labelWidth + week * step}
							y={headerHeight - 7 * fontScale}
						>
							{month}月
						</text>
					))}
					{LABELED_WEEKDAYS.map((weekday) => (
						<text
							key={weekday}
							className={styles.label}
							x={0}
							y={headerHeight + weekday * step + size / 2}
							dominantBaseline="central"
						>
							{WEEKDAY_LABELS[weekday]}
						</text>
					))}
					{cells.map((cell) => (
						<rect
							key={cell.day}
							className={styles.cell}
							data-day={cell.day}
							x={labelWidth + cell.week * step}
							y={headerHeight + cell.weekday * step}
							width={size}
							height={size}
							rx={2.5}
							fill={LEVEL_COLORS[cell.level]}
						/>
					))}
				</svg>
			</div>

			<ChartTooltip tip={tip}>
				{(day) => {
					const activity = days.get(day);
					return (
						<>
							<TooltipTitle>{formatDay(day)}</TooltipTitle>
							{activity ? (
								<>
									<TooltipRow
										label="ログインと試合"
										value={`${formatNumber(activity.count)} 回`}
									/>
									{ACTIVITY_GROUPS.filter((group) =>
										activity.groups.includes(group),
									).map((group) => (
										<TooltipRow
											key={group}
											color={ACTIVITY_GROUP_COLORS[group]}
											label={ACTIVITY_GROUP_LABELS[group]}
											value={`${formatNumber(activity.counts[group])} 回`}
										/>
									))}
								</>
							) : (
								<TooltipRow label="記録なし" value="" />
							)}
						</>
					);
				}}
			</ChartTooltip>
		</div>
	);
}
