import { scaleLinear } from "d3-scale";
import { useMemo, useRef } from "react";
import { formatNumber } from "../../labels/format.ts";
import { useElementWidth } from "../useElementWidth.ts";
import { useFontScale } from "../useFontScale.ts";
import { ChartTooltip, TooltipRow, TooltipTitle } from "./ChartTooltip.tsx";
import type { LegendItem } from "./Legend.tsx";
import styles from "./StackedBars.module.css";
import { useChartTooltip } from "./useChartTooltip.ts";

const PLOT_HEIGHT = 200;
const MARGIN = { top: 10, right: 4, bottom: 26, left: 40 };
const MAX_BAR_WIDTH = 24;
/** 積み上げた区切りの間に空ける、地の色のすき間。 */
const SEGMENT_GAP = 2;
const END_RADIUS = 4;

export interface BarBucket {
	key: string | number;
	/** 横軸と吹き出しに出す名前。 */
	label: string;
	/** 横軸の幅が足りないときに使う短い名前。 */
	shortLabel?: string;
	/** 系列ごとの値。`series` と同じ順に並べる。 */
	values: readonly number[];
}

interface StackedBarsProps {
	series: readonly LegendItem[];
	buckets: readonly BarBucket[];
	/** 値の単位。例: `日` */
	unit: string;
	/** 図全体の説明。読み上げに使う。 */
	label: string;
}

/** 上端だけを丸めた長方形。棒の根元は基準線にそろえて角のままにする。 */
function roundedTop(
	x: number,
	y: number,
	width: number,
	height: number,
): string {
	const radius = Math.min(END_RADIUS, width / 2, height);
	return [
		`M${x},${y + height}`,
		`V${y + radius}`,
		`Q${x},${y} ${x + radius},${y}`,
		`H${x + width - radius}`,
		`Q${x + width},${y} ${x + width},${y + radius}`,
		`V${y + height}`,
		"Z",
	].join("");
}

/** 積み上げ棒グラフ。区切りごとに、系列の値を下から決まった順に積む。 */
export function StackedBars({
	series,
	buckets,
	unit,
	label,
}: StackedBarsProps) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const width = useElementWidth(wrapperRef, 720);
	const fontScale = useFontScale();
	// 目盛りの文字が入る余白は、文字サイズの設定に合わせて広げる
	const left = Math.round(MARGIN.left * fontScale);
	const bottom = Math.round(MARGIN.bottom * fontScale);
	const { containerRef, tip, showAt, showAtElement, hide } =
		useChartTooltip<BarBucket>();

	const plotWidth = Math.max(0, width - left - MARGIN.right);
	const band = buckets.length > 0 ? plotWidth / buckets.length : 0;
	const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(3, band * 0.62));
	const plotBottom = MARGIN.top + PLOT_HEIGHT;
	const height = plotBottom + bottom;

	const { scale, ticks } = useMemo(() => {
		const max = Math.max(
			1,
			...buckets.map((bucket) =>
				bucket.values.reduce((sum, value) => sum + value, 0),
			),
		);
		const scale = scaleLinear()
			.domain([0, max])
			.nice(4)
			.range([MARGIN.top + PLOT_HEIGHT, MARGIN.top]);
		return { scale, ticks: scale.ticks(4).filter(Number.isInteger) };
	}, [buckets]);

	// 横軸の名前が重ならないよう、幅に応じて短い名前に切り替えるか、間引く
	const useShort = band < 46;
	const labelEvery = band < 26 ? 2 : 1;

	return (
		<div ref={containerRef} className={styles.container}>
			<div ref={wrapperRef}>
				{/* biome-ignore lint/a11y/useSemanticElements: SVG の中の棒をまとめるので、fieldset は使えない */}
				<svg
					className={styles.svg}
					width={width}
					height={height}
					role="group"
					aria-label={label}
				>
					{ticks.map((tick) => (
						<g key={tick}>
							<line
								className={tick === 0 ? styles.baseline : styles.grid}
								x1={left}
								x2={width - MARGIN.right}
								y1={scale(tick)}
								y2={scale(tick)}
							/>
							<text
								className={styles.tick}
								x={left - 8}
								y={scale(tick)}
								textAnchor="end"
								dominantBaseline="central"
							>
								{formatNumber(tick)}
							</text>
						</g>
					))}

					{buckets.map((bucket, index) => {
						const bandStart = left + index * band;
						const barStart = bandStart + (band - barWidth) / 2;
						const total = bucket.values.reduce((sum, value) => sum + value, 0);
						const topIndex = bucket.values.findLastIndex((value) => value > 0);
						const summary = series
							.map((item, seriesIndex) => ({
								item,
								value: bucket.values[seriesIndex] ?? 0,
							}))
							.filter(({ value }) => value > 0)
							.map(
								({ item, value }) =>
									`${item.label} ${formatNumber(value)} ${unit}`,
							)
							.join("、");

						let stacked = 0;
						return (
							<g key={bucket.key}>
								{/* 棒より広い当たり判定。区切りの幅と高さの全体で反応する */}
								{/* biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: キーボードでも値を確かめられるよう区切りごとに選べるようにするが、押して何かが起きる操作部品ではない */}
								<rect
									className={styles.hit}
									x={bandStart}
									y={MARGIN.top}
									width={band}
									height={PLOT_HEIGHT}
									tabIndex={0}
									role="img"
									aria-label={`${bucket.label}: ${summary || "記録なし"}`}
									onPointerMove={(event) =>
										showAt(event.clientX, event.clientY, bucket)
									}
									onPointerLeave={hide}
									onFocus={(event) =>
										showAtElement(event.currentTarget, bucket)
									}
									onBlur={hide}
								/>
								{total > 0 &&
									bucket.values.map((value, seriesIndex) => {
										const item = series[seriesIndex];
										if (!item || value <= 0) {
											return null;
										}
										const yTop = scale(stacked + value);
										const yBottom = scale(stacked);
										const isBottom = stacked === 0;
										stacked += value;
										const segmentHeight = Math.max(
											1,
											yBottom - yTop - (isBottom ? 0 : SEGMENT_GAP),
										);
										return seriesIndex === topIndex ? (
											<path
												key={item.id}
												className={styles.segment}
												d={roundedTop(barStart, yTop, barWidth, segmentHeight)}
												fill={item.color}
											/>
										) : (
											<rect
												key={item.id}
												className={styles.segment}
												x={barStart}
												y={yTop}
												width={barWidth}
												height={segmentHeight}
												fill={item.color}
											/>
										);
									})}
								{index % labelEvery === 0 && (
									<text
										className={styles.tick}
										x={bandStart + band / 2}
										y={plotBottom + 16 * fontScale}
										textAnchor="middle"
									>
										{useShort
											? (bucket.shortLabel ?? bucket.label)
											: bucket.label}
									</text>
								)}
							</g>
						);
					})}
				</svg>
			</div>

			<ChartTooltip tip={tip}>
				{(bucket) => {
					const rows = series
						.map((item, index) => ({ item, value: bucket.values[index] ?? 0 }))
						.filter(({ value }) => value > 0);
					return (
						<>
							<TooltipTitle>{bucket.label}</TooltipTitle>
							{rows.length === 0 && <TooltipRow label="記録なし" value="" />}
							{rows.map(({ item, value }) => (
								<TooltipRow
									key={item.id}
									color={item.color}
									label={item.label}
									value={`${formatNumber(value)} ${unit}`}
								/>
							))}
						</>
					);
				}}
			</ChartTooltip>
		</div>
	);
}
