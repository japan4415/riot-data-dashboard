import { scaleLinear } from "d3-scale";
import {
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	useMemo,
	useRef,
	useState,
} from "react";
import { formatNumber } from "../../labels/format.ts";
import { useElementWidth } from "../useElementWidth.ts";
import { useFontScale } from "../useFontScale.ts";
import { ChartTooltip } from "./ChartTooltip.tsx";
import styles from "./StepLineChart.module.css";
import { useChartTooltip } from "./useChartTooltip.ts";

const PLOT_HEIGHT = 180;
const MARGIN = { top: 10, right: 12, bottom: 26, left: 48 };

export interface LinePoint {
	x: number;
	y: number;
}

export interface AxisTick {
	value: number;
	label: string;
}

interface StepLineChartProps<Point extends LinePoint> {
	/** `x` の小さい順に並んでいること。 */
	points: readonly Point[];
	/** 横軸の範囲。省くと、点の範囲にする。 */
	xDomain?: readonly [number, number];
	xTicks: readonly AxisTick[];
	/** 縦軸の範囲と目盛り。省くと、0 から最大値までを切りのよい値で区切る。 */
	yDomain?: readonly [number, number];
	yTicks?: readonly AxisTick[];
	/** 最初の点より前から続いている値。あれば、左端からその値で線を引く。 */
	opening?: number | null;
	/** 最後の値を、右端まで延ばすか。 */
	extend?: boolean;
	/** 縦軸の目盛りの文字が入る幅（px、標準の文字サイズのとき）。 */
	leftMargin?: number;
	/** 図全体の説明。読み上げに使う。 */
	label: string;
	/** 選んだ点の内容。吹き出しに出す。 */
	tooltip: (point: Point) => ReactNode;
}

/** `x` がもっとも近い点の位置を返す。同じ距離なら、右の点を返す。 */
export function nearestIndex(points: readonly LinePoint[], x: number): number {
	let low = 0;
	let high = points.length - 1;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		const point = points[middle];
		if (point && point.x < x) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}
	const previous = points[low - 1];
	const current = points[low];
	if (previous && current && x - previous.x < current.x - x) {
		return low - 1;
	}
	return low;
}

/**
 * 階段状の折れ線グラフ。
 *
 * 残高やランクのように、次の記録まで同じ値が続くものを描く。点と点を斜めに結ぶと、
 * 記録の無い間も少しずつ変わったように見えてしまうので、水平と垂直の線だけで結ぶ。
 */
export function StepLineChart<Point extends LinePoint>({
	points,
	xDomain,
	xTicks,
	yDomain,
	yTicks,
	opening = null,
	extend = false,
	leftMargin = MARGIN.left,
	label,
	tooltip,
}: StepLineChartProps<Point>) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const width = useElementWidth(wrapperRef, 720);
	const fontScale = useFontScale();
	const left = Math.round(leftMargin * fontScale);
	const bottom = Math.round(MARGIN.bottom * fontScale);
	const { containerRef, tip, showAt, hide } = useChartTooltip<Point>();
	const [selected, setSelected] = useState<number | null>(null);

	const plotRight = Math.max(left + 1, width - MARGIN.right);
	const plotBottom = MARGIN.top + PLOT_HEIGHT;
	const height = plotBottom + bottom;

	const { xScale, yScale, ticks } = useMemo(() => {
		const firstX = points[0]?.x ?? 0;
		const lastX = points.at(-1)?.x ?? firstX + 1;
		const domainX = xDomain ?? [firstX, lastX === firstX ? firstX + 1 : lastX];
		const xScale = scaleLinear().domain(domainX).range([left, plotRight]);

		let top = Math.max(1, opening ?? 0);
		for (const point of points) {
			top = Math.max(top, point.y);
		}
		const yScale = scaleLinear()
			.domain(yDomain ?? [0, top])
			.range([plotBottom, MARGIN.top]);
		if (!yDomain) {
			yScale.nice(4);
		}
		const ticks =
			yTicks ??
			yScale
				.ticks(4)
				.filter(Number.isInteger)
				.map((value) => ({ value, label: formatNumber(value) }));
		return { xScale, yScale, ticks };
	}, [points, xDomain, yDomain, yTicks, opening, left, plotRight, plotBottom]);

	const path = useMemo(() => {
		const commands: string[] = [];
		const first = points[0];
		if (!first) {
			return opening === null ? "" : `M${left},${yScale(opening)}H${plotRight}`;
		}
		if (opening === null) {
			commands.push(`M${xScale(first.x)},${yScale(first.y)}`);
		} else {
			commands.push(`M${left},${yScale(opening)}`);
		}
		for (const point of points) {
			// 次の記録の位置まで水平に進み、そこで新しい値へ上下する
			commands.push(`H${xScale(point.x)}`, `V${yScale(point.y)}`);
		}
		if (extend) {
			commands.push(`H${plotRight}`);
		}
		return commands.join("");
	}, [points, opening, extend, xScale, yScale, left, plotRight]);

	const select = (index: number | null) => {
		const point = index === null ? undefined : points[index];
		const svg = svgRef.current;
		if (index === null || !point || !svg) {
			setSelected(null);
			hide();
			return;
		}
		setSelected(index);
		const rect = svg.getBoundingClientRect();
		showAt(rect.left + xScale(point.x), rect.top + yScale(point.y), point);
	};

	const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
		if (points.length === 0) {
			return;
		}
		const rect = event.currentTarget.getBoundingClientRect();
		select(nearestIndex(points, xScale.invert(event.clientX - rect.left)));
	};

	const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
		if (points.length === 0) {
			return;
		}
		const last = points.length - 1;
		// 点の数が減ったあとでも、範囲の中から動かす
		const current = Math.min(selected ?? last, last);
		const step = event.shiftKey ? 10 : 1;
		let next: number;
		switch (event.key) {
			case "ArrowLeft":
				next = Math.max(0, current - step);
				break;
			case "ArrowRight":
				next = Math.min(last, current + step);
				break;
			case "Home":
				next = 0;
				break;
			case "End":
				next = last;
				break;
			default:
				return;
		}
		event.preventDefault();
		select(next);
	};

	const selectedPoint =
		selected === null
			? undefined
			: points[Math.min(selected, points.length - 1)];

	// 横軸の名前が重ならないよう、前の名前から十分に離れたものだけを残す
	const minTickGap = 44 * fontScale;
	let lastTickX = Number.NEGATIVE_INFINITY;
	const visibleXTicks = xTicks.filter((tick) => {
		const position = xScale(tick.value);
		if (
			position < left ||
			position > plotRight ||
			position - lastTickX < minTickGap
		) {
			return false;
		}
		lastTickX = position;
		return true;
	});

	return (
		<div ref={containerRef} className={styles.container}>
			<div ref={wrapperRef}>
				<svg
					ref={svgRef}
					className={styles.svg}
					width={width}
					height={height}
					role="img"
					aria-label={`${label}左右の矢印キーで記録を選べます。値の一覧は表の表示で確かめられます。`}
					// biome-ignore lint/a11y/noNoninteractiveTabindex: 矢印キーで点を選んで値を確かめられるよう、図にフォーカスを置けるようにする
					tabIndex={0}
					onPointerMove={onPointerMove}
					onPointerLeave={(event) => {
						// キーボードで選んでいる間は、ポインタが外れても選択を保つ
						if (document.activeElement !== event.currentTarget) {
							select(null);
						}
					}}
					onFocus={() => select(selected ?? points.length - 1)}
					onBlur={() => select(null)}
					onKeyDown={onKeyDown}
				>
					{ticks.map((tick) => (
						<g key={tick.value}>
							<line
								className={styles.grid}
								x1={left}
								x2={plotRight}
								y1={yScale(tick.value)}
								y2={yScale(tick.value)}
							/>
							<text
								className={styles.tick}
								x={left - 8}
								y={yScale(tick.value)}
								textAnchor="end"
								dominantBaseline="central"
							>
								{tick.label}
							</text>
						</g>
					))}
					<line
						className={styles.baseline}
						x1={left}
						x2={plotRight}
						y1={plotBottom}
						y2={plotBottom}
					/>
					{visibleXTicks.map((tick) => (
						<text
							key={tick.value}
							className={styles.tick}
							x={xScale(tick.value)}
							y={plotBottom + 16 * fontScale}
							textAnchor="middle"
						>
							{tick.label}
						</text>
					))}

					<path className={styles.line} d={path} />

					{selectedPoint && (
						<g className={styles.cursor}>
							<line
								className={styles.crosshair}
								x1={xScale(selectedPoint.x)}
								x2={xScale(selectedPoint.x)}
								y1={MARGIN.top}
								y2={plotBottom}
							/>
							{/* 線と重なる点は、地の色の輪で線から切り離す */}
							<circle
								className={styles.dot}
								cx={xScale(selectedPoint.x)}
								cy={yScale(selectedPoint.y)}
								r={5}
							/>
						</g>
					)}
				</svg>
			</div>

			<ChartTooltip tip={tip}>{tooltip}</ChartTooltip>
		</div>
	);
}
