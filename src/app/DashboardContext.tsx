import {
	createContext,
	type ReactNode,
	useContext,
	useMemo,
	useState,
} from "react";
import {
	type ActivityIndex,
	buildActivityIndex,
} from "../analysis/activity.ts";
import { type GameScreen, gameScreens } from "../analysis/games.ts";
import { browserLocal, type ToLocal } from "../analysis/localTime.ts";
import { recordSpan, recordYears } from "../analysis/overview.ts";
import { ALL_PERIOD, type Period } from "../analysis/period.ts";
import { MaskModeProvider } from "../components/MaskContext.tsx";
import type { ImportResult } from "../import/importArchive.ts";
import type { Dataset, EpochMs } from "../model/types.ts";

interface DashboardValue {
	result: ImportResult;
	dataset: Dataset;
	/** 日ごとの活動。読み込んだデータから 1 度だけ作る。 */
	activity: ActivityIndex;
	/** 記録がある年。古い順。 */
	years: number[];
	/** もっとも新しい記録の時刻。記録が無ければ null。 */
	lastRecordAt: EpochMs | null;
	/** 専用の画面を出せるゲーム。メニューに並べる順。 */
	gameScreens: GameScreen[];
	/** すべての画面で共通の、表示する期間。 */
	period: Period;
	setPeriod: (period: Period) => void;
	/** 伏せ字モードが入っているか。画面を切り替えても保つ。 */
	maskMode: boolean;
	setMaskMode: (masked: boolean) => void;
	/** 時刻を利用者のタイムゾーンでの暦の値に直す関数。 */
	toLocal: ToLocal;
}

const DashboardContext = createContext<DashboardValue | null>(null);

interface DashboardProviderProps {
	result: ImportResult;
	children: ReactNode;
}

export function DashboardProvider({
	result,
	children,
}: DashboardProviderProps) {
	const [period, setPeriod] = useState<Period>(ALL_PERIOD);
	const [maskMode, setMaskMode] = useState(false);

	// 読み込んだデータから求める値は、期間を変えても作り直さない
	const derived = useMemo(() => {
		const dataset = result.dataset;
		return {
			result,
			dataset,
			activity: buildActivityIndex(dataset, browserLocal),
			years: recordYears(dataset, browserLocal),
			lastRecordAt: recordSpan(dataset)?.last ?? null,
			gameScreens: gameScreens(dataset),
			toLocal: browserLocal,
		};
	}, [result]);

	const value = useMemo<DashboardValue>(
		() => ({ ...derived, period, setPeriod, maskMode, setMaskMode }),
		[derived, period, maskMode],
	);

	return (
		<DashboardContext.Provider value={value}>
			<MaskModeProvider masked={maskMode}>{children}</MaskModeProvider>
		</DashboardContext.Provider>
	);
}

export function useDashboard(): DashboardValue {
	const value = useContext(DashboardContext);
	if (!value) {
		throw new Error("DashboardProvider の外では使えません");
	}
	return value;
}
