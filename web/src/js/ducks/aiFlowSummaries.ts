import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppThunk } from "./store";
import { fetchApi } from "../utils";
import { hideModal } from "./ui/modal";
import { FLOWS_RECEIVE, FLOWS_REMOVE } from "./flows";

export type AIFlowSummary = {
    rid: string;
    method: string;
    url: string;
    summary: string;
};

type FlowSummaryScanState = {
    running: boolean;
    done: number;
    total: number;
    error?: string;
};

type AIFlowSummariesState = {
    summaries: Record<string, AIFlowSummary>;
    selectedFlowId?: string;
    scan: FlowSummaryScanState;
};

const defaultState: AIFlowSummariesState = {
    summaries: {},
    selectedFlowId: undefined,
    scan: { running: false, done: 0, total: 0 },
};

const slice = createSlice({
    name: "aiFlowSummaries",
    initialState: defaultState,
    reducers: {
        clearSummaries(state) {
            state.summaries = {};
        },
        setSummary(
            state,
            action: PayloadAction<{ flowId: string; summary: AIFlowSummary }>,
        ) {
            state.summaries[action.payload.flowId] = action.payload.summary;
        },
        setSummaries(state, action: PayloadAction<Record<string, AIFlowSummary>>) {
            state.summaries = action.payload;
        },
        setSelectedFlowId(state, action: PayloadAction<string | undefined>) {
            state.selectedFlowId = action.payload;
        },
        setScanState(state, action: PayloadAction<FlowSummaryScanState>) {
            state.scan = action.payload;
        },
        setScanProgress(state, action: PayloadAction<{ done: number; total: number }>) {
            state.scan.done = action.payload.done;
            state.scan.total = action.payload.total;
        },
        setScanRunning(state, action: PayloadAction<boolean>) {
            state.scan.running = action.payload;
        },
        setScanError(state, action: PayloadAction<string | undefined>) {
            state.scan.error = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(FLOWS_RECEIVE, (state, action) => {
            const ids = new Set(action.payload.map((f) => f.id));
            const next: Record<string, AIFlowSummary> = {};
            for (const [flowId, summary] of Object.entries(state.summaries)) {
                if (ids.has(flowId)) {
                    next[flowId] = summary;
                }
            }
            state.summaries = next;
        });
        builder.addCase(FLOWS_REMOVE, (state, action) => {
            delete state.summaries[action.payload];
        });
    },
});

export const {
    clearSummaries,
    setSummary,
    setSummaries,
    setSelectedFlowId,
    setScanState,
    setScanProgress,
    setScanRunning,
    setScanError,
} = slice.actions;

export default slice.reducer;

export function fetchPersistedSummaries(): AppThunk<Promise<void>> {
    return async (dispatch) => {
        let res: Response;
        try {
            res = await fetchApi("/ai/flow_summaries", { method: "GET" });
        } catch {
            return;
        }
        if (!res.ok) {
            return;
        }
        let obj: any;
        try {
            obj = await res.json();
        } catch {
            return;
        }
        const summaries = obj?.summaries;
        if (summaries && typeof summaries === "object") {
            const next: Record<string, AIFlowSummary> = {};
            for (const [flowId, v] of Object.entries(summaries as any)) {
                if (!v || typeof v !== "object") {
                    continue;
                }
                const rid = (v as any).rid;
                const method = (v as any).method;
                const url = (v as any).url;
                const summary = (v as any).summary;
                if (
                    typeof rid === "string" &&
                    typeof method === "string" &&
                    typeof url === "string" &&
                    typeof summary === "string"
                ) {
                    next[flowId] = { rid, method, url, summary };
                }
            }
            dispatch(setSummaries(next));
        }
    };
}

export function startFlowSummaryScan(maxFlows: number): AppThunk<Promise<void>> {
    return async (dispatch) => {
        dispatch(clearSummaries());
        dispatch(setScanState({ running: true, done: 0, total: 0 }));

        const closeUi = () => {
            dispatch(hideModal());
            window.dispatchEvent(new Event("mitmweb:ai-assistant-close"));
        };

        let response: Response;
        try {
            response = await fetchApi("/ai/flow_summaries", {
                method: "POST",
                headers: {
                    Accept: "text/event-stream",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ max_flows: maxFlows }),
            });
        } catch {
            dispatch(setScanError("Request failed."));
            dispatch(setScanRunning(false));
            closeUi();
            return;
        }

        if (!response.ok || !response.body) {
            dispatch(setScanError(`Request failed (${response.status}).`));
            dispatch(setScanRunning(false));
            closeUi();
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buf = "";
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    break;
                }
                buf += decoder.decode(value, { stream: true });
                while (true) {
                    const idx = buf.indexOf("\n\n");
                    if (idx === -1) {
                        break;
                    }
                    const rawEvent = buf.slice(0, idx);
                    buf = buf.slice(idx + 2);
                    const lines = rawEvent.split("\n");
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith("data:")) {
                            continue;
                        }
                        const data = trimmed.slice("data:".length).trim();
                        if (!data) {
                            continue;
                        }
                        let obj: any;
                        try {
                            obj = JSON.parse(data);
                        } catch {
                            continue;
                        }

                        if (obj?.type === "start" && typeof obj.total === "number") {
                            dispatch(setScanProgress({ done: 0, total: obj.total }));
                        } else if (
                            obj?.type === "summary" &&
                            typeof obj.flow_id === "string" &&
                            typeof obj.summary === "string" &&
                            typeof obj.rid === "string" &&
                            typeof obj.method === "string" &&
                            typeof obj.url === "string"
                        ) {
                            dispatch(
                                setSummary({
                                    flowId: obj.flow_id,
                                    summary: {
                                        rid: obj.rid,
                                        method: obj.method,
                                        url: obj.url,
                                        summary: obj.summary,
                                    },
                                }),
                            );
                        } else if (
                            obj?.type === "summary_error" &&
                            typeof obj.flow_id === "string" &&
                            typeof obj.error === "string" &&
                            typeof obj.rid === "string" &&
                            typeof obj.method === "string" &&
                            typeof obj.url === "string"
                        ) {
                            dispatch(
                                setSummary({
                                    flowId: obj.flow_id,
                                    summary: {
                                        rid: obj.rid,
                                        method: obj.method,
                                        url: obj.url,
                                        summary: `Error generating summary: ${obj.error}`,
                                    },
                                }),
                            );
                        } else if (
                            obj?.type === "progress" &&
                            typeof obj.done === "number" &&
                            typeof obj.total === "number"
                        ) {
                            dispatch(setScanProgress({ done: obj.done, total: obj.total }));
                        } else if (obj?.type === "error" && typeof obj.error === "string") {
                            dispatch(setScanError(obj.error));
                        } else if (obj?.type === "done") {
                            dispatch(setScanRunning(false));
                            closeUi();
                            return;
                        }
                    }
                }
            }
            dispatch(setScanRunning(false));
            closeUi();
        } catch {
            dispatch(setScanError("Stream interrupted."));
            dispatch(setScanRunning(false));
            closeUi();
        } finally {
            try {
                reader.releaseLock();
            } catch {
                // ignore
            }
        }
    };
}
