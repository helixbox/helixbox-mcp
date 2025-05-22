// Helper: safely stringify objects with bigint
export function safeStringify(obj: any) {
    return JSON.stringify(obj, (_, v) => typeof v === "bigint" ? v.toString() : v);
}
