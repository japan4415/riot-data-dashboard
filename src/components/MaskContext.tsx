import { createContext, type ReactNode, useContext } from "react";

/**
 * 伏せ字モードが入っているかを、画面の部品に伝える。
 *
 * 伏せ字モードは、スクリーンショットを安全に撮るための切り替えである。入れると、
 * ふだんは表示している Riot ID や本文も伏せ、伏せてある値を表示する操作も止める。
 */
const MaskContext = createContext(false);

interface MaskModeProviderProps {
	masked: boolean;
	children: ReactNode;
}

export function MaskModeProvider({ masked, children }: MaskModeProviderProps) {
	return <MaskContext.Provider value={masked}>{children}</MaskContext.Provider>;
}

export function useMaskMode(): boolean {
	return useContext(MaskContext);
}
