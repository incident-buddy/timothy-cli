export function epochMills(): number {
	return Date.now();
}

export function now(): Date {
	return new Date(epochMills());
}

export function addSeconds(date: Date, seconds: number): Date {
	return new Date(date.getTime() + seconds * 1000);
}
