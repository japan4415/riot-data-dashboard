import { type PointerEvent, useMemo, useRef } from "react";
import {
	type HourWeekMatrix,
	levelOf,
	levelThresholds,
} from "../../analysis/activity.ts";
import { LEVEL_COLORS, WEEKDAY_LABELS } from "../../labels/activity.ts";
import { formatNumber, formatSlot } from "../../labels/format.ts";
import { useElementWidth } from "../useElementWidth.ts";
import { useFontScale } from "../useFontScale.ts";
import { ChartTooltip, TooltipRow, TooltipTitle } from "./ChartTooltip.tsx";
import styles from "./HourWeekHeatmap.module.css";
import { useChartTooltip } from "./useChartTooltip.ts";

const LABEL_WIDTH = 26;
const HEADER_HEIGHT = 18;
const ROW_HEIGHT = 26;
const GAP = 3;
const MIN_COLUMN = 18;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const WEEKDAYS = Array.from({ length: 7 }, (_, weekday) => weekday);

interface Slot {
	weekday: number;
	hour: number;
}

interface HourWeekHeatmapProps {
	/** 曜日（0 = 日曜）× 時刻（0〜23）ごとの回数。 */
	matrix: HourWeekMatrix;
}

/** 曜日と時刻ごとの回数。行が曜日、列が時刻。 */
export function HourWeekHeatmap({ matrix }: HourWeekHeatmapProps) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const width = useElementWidth(wrapperRef, 760);
	const fontScale = useFontScale();
	const labelWidth = Math.round(LABEL_WIDTH * fontScale);
	const headerHeight = Math.round(HEADER_HEIGHT * fontScale);
	const { containerRef, tip, showAt, hide } = useChartTooltip<Slot>();
	const thresholds = useMemo(() => levelThresholds(matrix.flat()), [matrix]);
	const total = useMemo(
		() => matrix.flat().reduce((sum, count) => sum + count, 0),
		[matrix],
	);

	const column = Math.max(
		Math.round(MIN_COLUMN * fontScale),
		Math.floor((width - labelWidth) / 24),
	);
	const svgWidth = labelWidth + column * 24;
	const svgHeight = headerHeight + ROW_HEIGHT * 7;

	function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
		const target = event.target as Element;
		const weekday = target.getAttribute?.("data-weekday");
		const hour = target.getAttribute?.("data-hour");
		if (weekday !== null && hour !== null && weekday !== undefined) {
			showAt(event.clientX, event.clientY, {
				weekday: Number(weekday),
				hour: Number(hour),
			});
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
					aria-label={`曜日と時刻ごとのログインと試合の回数。合計 ${formatNumber(total)} 回。値は、表の表示で確かめられます。`}
					onPointerMove={handlePointerMove}
					onPointerLeave={hide}
				>
					{HOURS.filter((hour) => hour % 3 === 0).map((hour) => (
						<text
							key={hour}
							className={styles.label}
							x={labelWidth + hour * column}
							y={headerHeight - 7 * fontScale}
						>
							{hour}時
						</text>
					))}
					{WEEKDAYS.map((weekday) => (
						<text
							key={weekday}
							className={styles.label}
							x={0}
							y={headerHeight + weekday * ROW_HEIGHT + (ROW_HEIGHT - GAP) / 2}
							dominantBaseline="central"
						>
							{WEEKDAY_LABELS[weekday]}
						</text>
					))}
					{WEEKDAYS.flatMap((weekday) =>
						HOURS.map((hour) => {
							const count = matrix[weekday]?.[hour] ?? 0;
							return (
								<rect
									key={`${weekday}-${hour}`}
									className={styles.cell}
									data-weekday={weekday}
									data-hour={hour}
									x={labelWidth + hour * column}
									y={headerHeight + weekday * ROW_HEIGHT}
									width={column - GAP}
									height={ROW_HEIGHT - GAP}
									rx={3}
									fill={LEVEL_COLORS[levelOf(count, thresholds)]}
								/>
							);
						}),
					)}
				</svg>
			</div>

			<ChartTooltip tip={tip}>
				{({ weekday, hour }) => (
					<>
						<TooltipTitle>{formatSlot(weekday, hour)}</TooltipTitle>
						<TooltipRow
							label="ログインと試合"
							value={`${formatNumber(matrix[weekday]?.[hour] ?? 0)} 回`}
						/>
					</>
				)}
			</ChartTooltip>
		</div>
	);
}
