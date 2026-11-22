import { useId } from "react";
import styles from "./SelectField.module.css";

export interface SelectOption<Value extends string> {
	value: Value;
	label: string;
}

interface SelectFieldProps<Value extends string> {
	label: string;
	value: Value;
	options: ReadonlyArray<SelectOption<Value>>;
	onChange: (value: Value) => void;
}

/** 名前の付いた選択欄。一覧の絞り込みに使う。 */
export function SelectField<Value extends string>({
	label,
	value,
	options,
	onChange,
}: SelectFieldProps<Value>) {
	const id = useId();
	return (
		<div className={styles.field}>
			<label htmlFor={id} className={styles.label}>
				{label}
			</label>
			<select
				id={id}
				className={styles.select}
				value={value}
				onChange={(event) => {
					const next = options.find(
						(option) => option.value === event.target.value,
					);
					if (next) {
						onChange(next.value);
					}
				}}
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</div>
	);
}
