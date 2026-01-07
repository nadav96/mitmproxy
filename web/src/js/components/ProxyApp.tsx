import React, { Component, type JSX } from "react";
import classnames from "classnames";
import { onKeyDown } from "../ducks/ui/keyboard";
import MainView from "./MainView";
import Header from "./Header";
import CommandBar from "./CommandBar";
import EventLog from "./EventLog";
import Footer from "./Footer";
import Modal from "./Modal/Modal";
import { fetchApi } from "../utils";
import type { RootState } from "../ducks";
import { connect } from "react-redux";
import { store } from "../ducks";
import { setFilter, setHighlight } from "../ducks/ui/filter";
import * as modalActions from "../ducks/ui/modal";
import { update as updateOptions, type Option } from "../ducks/options";
import Filt from "../filt/filt";

type ProxyAppMainProps = {
    showEventLog: boolean;
    showCommandBar: boolean;
    onKeyDown: (e: KeyboardEvent) => void;
};

type AIAssistantMessage = {
    id: number;
    role: "user" | "assistant";
    text?: string;
    status?: "loading";
};

type ProxyAppMainState = {
    error?: Error;
    errorInfo?: React.ErrorInfo;
    aiAssistantIconFailed?: boolean;
    aiAssistantOpen?: boolean;
    aiAssistantDraft?: string;
    aiAssistantMessages?: AIAssistantMessage[];
};

export interface Menu {
    (): JSX.Element;
    title: string;
}

class ProxyAppMain extends Component<ProxyAppMainProps, ProxyAppMainState> {
    state: ProxyAppMainState = {
        aiAssistantIconFailed: false,
        aiAssistantOpen: false,
        aiAssistantDraft: "",
        aiAssistantMessages: [
            {
                id: 1,
                role: "assistant",
                text: "Hi! This is a UI-only assistant drawer (no backend connected yet).",
            },
        ],
    };

    aiAssistantNextMessageId = 2;
    aiAssistantAbort?: AbortController;

    aiAssistantInputRef = React.createRef<HTMLInputElement>();

    onAIAssistantClick = () => {
        this.setState(
            (s) => ({ aiAssistantOpen: !s.aiAssistantOpen }),
            () => {
                if (this.state.aiAssistantOpen) {
                    this.aiAssistantInputRef.current?.focus();
                }
            },
        );
    };

    openAIAssistant = () => {
        this.setState({ aiAssistantOpen: true }, () => {
            this.aiAssistantInputRef.current?.focus();
        });
    };

    closeAIAssistant = () => {
        this.aiAssistantAbort?.abort();
        this.setState({ aiAssistantOpen: false });
    };

    openAIFlowSummaryScanModal = () => {
        store.dispatch(modalActions.setActiveModal("AIFlowSummaryScanModal"));
    };

    onAIAssistantIconError = () => {
        this.setState({ aiAssistantIconFailed: true });
    };

    onAIAssistantDraftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ aiAssistantDraft: e.target.value });
    };

    onAIAssistantSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const text = (this.state.aiAssistantDraft ?? "").trim();
        if (!text) {
            return;
        }

        const userMessage: AIAssistantMessage = {
            id: this.aiAssistantNextMessageId++,
            role: "user",
            text,
        };
        const loadingId = this.aiAssistantNextMessageId++;
        const loadingMessage: AIAssistantMessage = {
            id: loadingId,
            role: "assistant",
            status: "loading",
        };

        const messagesForApi = [
            ...(this.state.aiAssistantMessages ?? []).filter(
                (m) => m.status !== "loading",
            ),
            userMessage,
        ]
            .map((m) => ({ role: m.role, content: m.text ?? "" }))
            .filter((m) => m.content.trim().length > 0);

        this.setState((s) => ({
            aiAssistantDraft: "",
            aiAssistantMessages: [
                ...(s.aiAssistantMessages ?? []),
                userMessage,
                loadingMessage,
            ],
        }));

        this.startAIAssistantStream(loadingId, messagesForApi);
    };

    startAIAssistantStream = async (
        loadingId: number,
        messages: Array<{ role: string; content: string }>,
    ) => {
        this.aiAssistantAbort?.abort();
        const abort = new AbortController();
        this.aiAssistantAbort = abort;

        let response: Response;
        try {
            response = await fetchApi("/ai/chat", {
                method: "POST",
                headers: {
                    Accept: "text/event-stream",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ messages }),
                signal: abort.signal,
            });
        } catch (e) {
            this.setState((s) => ({
                aiAssistantMessages: (s.aiAssistantMessages ?? []).map((m) =>
                    m.id === loadingId
                        ? {
                              ...m,
                              status: undefined,
                              text: "Request failed.",
                          }
                        : m,
                ),
            }));
            return;
        }

        if (!response.ok || !response.body) {
            this.setState((s) => ({
                aiAssistantMessages: (s.aiAssistantMessages ?? []).map((m) =>
                    m.id === loadingId
                        ? {
                              ...m,
                              status: undefined,
                              text: `Request failed (${response.status}).`,
                          }
                        : m,
                ),
            }));
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buf = "";

        const applyDelta = (delta: string) => {
            this.setState((s) => ({
                aiAssistantMessages: (s.aiAssistantMessages ?? []).map((m) => {
                    if (m.id !== loadingId) {
                        return m;
                    }
                    const nextText = (m.text ?? "") + delta;
                    return {
                        ...m,
                        status: undefined,
                        text: nextText,
                    };
                }),
            }));
        };

        const finalize = () => {
            this.setState((s) => ({
                aiAssistantMessages: (s.aiAssistantMessages ?? []).map((m) =>
                    m.id === loadingId ? { ...m, status: undefined } : m,
                ),
            }));
        };

        const fail = (error: string) => {
            this.setState((s) => ({
                aiAssistantMessages: (s.aiAssistantMessages ?? []).map((m) =>
                    m.id === loadingId
                        ? { ...m, status: undefined, text: error }
                        : m,
                ),
            }));
        };

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
                        if (obj?.type === "delta" && typeof obj.delta === "string") {
                            applyDelta(obj.delta);
                        } else if (obj?.type === "tool" && typeof obj.name === "string") {
                            const expr = obj?.arguments?.expr;
                            if (typeof expr === "string") {
                                let valid = true;
                                try {
                                    if (expr) {
                                        Filt.parse(expr);
                                    }
                                } catch {
                                    valid = false;
                                }
                                if (!valid) {
                                    applyDelta("(Invalid filter expression — not applied.)\n");
                                    continue;
                                }

                                if (obj.name === "set_search_filter") {
                                    store.dispatch(setFilter(expr));
                                    applyDelta("(Applied Search filter.)\n");
                                } else if (obj.name === "set_highlight_filter") {
                                    store.dispatch(setHighlight(expr));
                                    applyDelta("(Applied Highlight filter.)\n");
                                } else if (obj.name === "set_intercept_filter") {
                                    store.dispatch(updateOptions("intercept" as Option, expr));
                                    applyDelta("(Applied Intercept filter.)\n");
                                }
                            }
                        } else if (obj?.type === "done") {
                            finalize();
                            this.aiAssistantAbort = undefined;
                            return;
                        } else if (
                            obj?.type === "error" &&
                            typeof obj.error === "string"
                        ) {
                            fail(obj.error);
                            this.aiAssistantAbort = undefined;
                            return;
                        }
                    }
                }
            }
            finalize();
        } catch (e) {
            if (!abort.signal.aborted) {
                fail("Stream interrupted.");
            }
        } finally {
            this.aiAssistantAbort = undefined;
            try {
                reader.releaseLock();
            } catch {
                // ignore
            }
        }
    };

    onAppKeyDown = (e: KeyboardEvent) => {
        if (this.state.aiAssistantOpen) {
            return;
        }
        this.props.onKeyDown(e);
    };

    onDrawerKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            this.closeAIAssistant();
        }
        e.stopPropagation();
    };

    onAIAssistantEvent = () => {
        this.openAIAssistant();
    };

    render = () => {
        const { showEventLog, showCommandBar } = this.props;

        if (this.state.error) {
            console.log("ERR", this.state);
            return (
                <div className="container">
                    <h1>mitmproxy has crashed.</h1>
                    <pre>
                        {this.state.error.stack}
                        <br />
                        <br />
                        Component Stack:
                        {this.state.errorInfo?.componentStack}
                    </pre>

                    <p>
                        Please lodge a bug report at{" "}
                        <a href="https://github.com/mitmproxy/mitmproxy/issues">
                            https://github.com/mitmproxy/mitmproxy/issues
                        </a>
                        .
                    </p>
                </div>
            );
        }

        return (
            <div id="container" tabIndex={0}>
                <Header />
                <MainView />
                {showCommandBar && <CommandBar key="commandbar" />}
                {showEventLog && <EventLog key="eventlog" />}
                <Footer />
                <Modal />
                {this.state.aiAssistantOpen && (
                    <div
                        className="ai-assistant-overlay"
                        onClick={this.closeAIAssistant}
                    />
                )}
                <div
                    className={classnames("ai-assistant-drawer", {
                        open: this.state.aiAssistantOpen,
                    })}
                    role="dialog"
                    aria-modal={this.state.aiAssistantOpen ? "true" : "false"}
                    aria-label="Ask AgentForce"
                    onKeyDown={this.onDrawerKeyDown}
                >
                    <div className="ai-assistant-header">
                        <div className="ai-assistant-title">Ask AgentForce</div>
                        <div className="ai-assistant-header-actions">
                            <button
                                type="button"
                                className="ai-assistant-action"
                                aria-label="Generate flow summaries"
                                title="Generate flow summaries"
                                onClick={this.openAIFlowSummaryScanModal}
                            >
                                <i className="fa fa-fw fa-lightbulb-o" />
                            </button>
                            <button
                                type="button"
                                className="ai-assistant-close"
                                aria-label="Close"
                                onClick={this.closeAIAssistant}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                    <div className="ai-assistant-messages">
                        {(this.state.aiAssistantMessages ?? []).map((m, i) => (
                            <div
                                key={m.id}
                                className={classnames("ai-assistant-msg", m.role)}
                            >
                                <div className="ai-assistant-bubble">
                                    {m.status === "loading" ? (
                                        <span className="ai-assistant-typing">
                                            <span />
                                            <span />
                                            <span />
                                        </span>
                                    ) : (
                                        m.text
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <form
                        className="ai-assistant-input"
                        onSubmit={this.onAIAssistantSubmit}
                    >
                        <input
                            ref={this.aiAssistantInputRef}
                            type="text"
                            value={this.state.aiAssistantDraft}
                            onChange={this.onAIAssistantDraftChange}
                            placeholder="Ask something…"
                        />
                        <button type="submit">Send</button>
                    </form>
                </div>
                <button
                    type="button"
                    className="ai-assistant-fab"
                    title="Ask AgentForce"
                    onClick={this.onAIAssistantClick}
                >
                    {this.state.aiAssistantIconFailed ? (
                        <i className="fa fa-magic" aria-hidden="true" />
                    ) : (
                        <img
                            className="ai-assistant-fab-img"
                            src="/static/agentforce.png"
                            alt=""
                            onError={this.onAIAssistantIconError}
                        />
                    )}
                </button>
            </div>
        );
    };

    componentDidMount() {
        window.addEventListener("keydown", this.onAppKeyDown);
        window.addEventListener(
            "mitmweb:ai-assistant",
            this.onAIAssistantEvent as EventListener,
        );
        window.addEventListener(
            "mitmweb:ai-assistant-close",
            this.closeAIAssistant as EventListener,
        );
    }

    componentWillUnmount() {
        window.removeEventListener("keydown", this.onAppKeyDown);
        window.removeEventListener(
            "mitmweb:ai-assistant",
            this.onAIAssistantEvent as EventListener,
        );
        window.removeEventListener(
            "mitmweb:ai-assistant-close",
            this.closeAIAssistant as EventListener,
        );

        this.aiAssistantAbort?.abort();
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({ error, errorInfo });
    }
}

export default connect(
    (state: RootState) => ({
        showEventLog: state.eventLog.visible,
        showCommandBar: state.commandBar.visible,
    }),
    {
        onKeyDown,
    },
)(ProxyAppMain);
