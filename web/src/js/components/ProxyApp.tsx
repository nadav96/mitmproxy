import React, { Component, type JSX } from "react";
import classnames from "classnames";
import { onKeyDown } from "../ducks/ui/keyboard";
import MainView from "./MainView";
import Header from "./Header";
import CommandBar from "./CommandBar";
import EventLog from "./EventLog";
import Footer from "./Footer";
import Modal from "./Modal/Modal";
import type { RootState } from "../ducks";
import { connect } from "react-redux";

type ProxyAppMainProps = {
    showEventLog: boolean;
    showCommandBar: boolean;
    onKeyDown: (e: KeyboardEvent) => void;
};

type ProxyAppMainState = {
    error?: Error;
    errorInfo?: React.ErrorInfo;
    aiAssistantIconFailed?: boolean;
    aiAssistantOpen?: boolean;
    aiAssistantDraft?: string;
    aiAssistantMessages?: Array<{ role: "user" | "assistant"; text: string }>;
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
                role: "assistant",
                text: "Hi! This is a UI-only assistant drawer (no backend connected yet).",
            },
        ],
    };

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
        this.setState({ aiAssistantOpen: false });
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
        this.setState((s) => ({
            aiAssistantDraft: "",
            aiAssistantMessages: [
                ...(s.aiAssistantMessages ?? []),
                { role: "user", text },
                {
                    role: "assistant",
                    text: "(Placeholder) I’m not connected to an AI yet — wire me up to a backend when ready.",
                },
            ],
        }));
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
                    aria-label="AI Assistant"
                    onKeyDown={this.onDrawerKeyDown}
                >
                    <div className="ai-assistant-header">
                        <div className="ai-assistant-title">AI Assistant</div>
                        <button
                            type="button"
                            className="ai-assistant-close"
                            aria-label="Close"
                            onClick={this.closeAIAssistant}
                        >
                            ×
                        </button>
                    </div>
                    <div className="ai-assistant-messages">
                        {(this.state.aiAssistantMessages ?? []).map((m, i) => (
                            <div
                                key={i}
                                className={classnames("ai-assistant-msg", m.role)}
                            >
                                <div className="ai-assistant-bubble">{m.text}</div>
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
                    title="AI Assistant"
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
    }

    componentWillUnmount() {
        window.removeEventListener("keydown", this.onAppKeyDown);
        window.removeEventListener(
            "mitmweb:ai-assistant",
            this.onAIAssistantEvent as EventListener,
        );
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
