import { styleText } from "node:util";

export const green = (text: string): string => styleText("green", text);
export const blue = (text: string): string => styleText("blue", text);
export const yellow = (text: string): string => styleText("yellow", text);
export const bold = (text: string): string => styleText("bold", text);

export function color(text: string, ...fns: ((text: string) => string)[]): string {
	return fns.reduce((acc, fn) => fn(acc), text);
}
