import styles from "./ImportPage.module.css";

const DATA_HANDLING = [
	{
		title: "ブラウザの中だけで処理します",
		body: "zip の展開と集計は、すべてこのブラウザの中で行います。",
	},
	{
		title: "サーバーには送りません",
		body: "ファイルの中身は、どこにも送信しません。",
	},
	{
		title: "保存しません",
		body: "ページを閉じるか再読み込みすると、読み込んだデータは消えます。",
	},
] as const;

export function ImportPage() {
	return (
		<>
			<section className={styles.intro} aria-labelledby="intro-heading">
				<h1 id="intro-heading" className={styles.heading}>
					Riot Games のアカウントデータを振り返る
				</h1>
				<p className={styles.lead}>
					Riot Games に開示を請求して届いた zip
					ファイルを読み込み、遊んだ時間、勝敗、課金の記録を図表で表示します。
				</p>
				<p className={styles.notice}>
					<span className={styles.noticeLabel}>準備中</span>
					zip の読み込みは、まだ使えません。
				</p>
			</section>

			<section
				className={styles.handling}
				aria-labelledby="data-handling-heading"
			>
				<h2 id="data-handling-heading" className={styles.sectionHeading}>
					データの扱い
				</h2>
				<ul className={styles.cards}>
					{DATA_HANDLING.map((item) => (
						<li key={item.title} className={styles.card}>
							<h3 className={styles.cardTitle}>{item.title}</h3>
							<p className={styles.cardBody}>{item.body}</p>
						</li>
					))}
				</ul>
			</section>
		</>
	);
}
