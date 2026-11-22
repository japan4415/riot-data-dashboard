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
import { browserLocal, type ToLocal } from "../analysis/localTime.ts";
import { recordYears } from "../analysis/overview.ts";
import { ALL_PERIOD, type Period } from "../analysis/period.ts";
import type { ImportResult } from "../import/importArchive.ts";
import type { Dataset } from "../model/types.ts";

interface DashboardValue {
	result: ImportResult;
	dataset: Dataset;
	/** 日ごとの活動。読み込んだデータから 1 度だけ作る。 */
	activity: ActivityIndex;
	/** 記録がある年。古い順。 */
	years: number[];
	/** すべての画面で共通の、表示する期間。 */
	period: Period;
	setPeriod: (period: Period) => void;
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

	const value = useMemo<DashboardValue>(() => {
		const dataset = result.dataset;
		return {
			result,
			dataset,
			activity: buildActivityIndex(dataset, browserLocal),
			years: recordYears(dataset, browserLocal),
			period,
			setPeriod,
			toLocal: browserLocal,
		};
	}, [result, period]);

	return (
		<DashboardContext.Provider value={value}>
			{children}
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
