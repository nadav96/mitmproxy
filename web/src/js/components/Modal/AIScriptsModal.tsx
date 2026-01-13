import React, { useEffect, useMemo, useState } from "react";
import ModalLayout from "./ModalLayout";
import { fetchApi } from "../../utils";
import * as modalActions from "../../ducks/ui/modal";
import { useAppDispatch } from "../../ducks";

type ScriptInfo = {
    name: string;
    path: string;
    enabled: boolean;
};

type ScriptsResponse = {
    scripts: ScriptInfo[];
    active: string[];
};

type ScriptItemResponse = {
    name: string;
    path: string;
    content: string;
};

export default function AIScriptsModal() {
    const dispatch = useAppDispatch();

    const [scripts, setScripts] = useState<ScriptInfo[]>([]);
    const [activePaths, setActivePaths] = useState<string[]>([]);
    const [selectedName, setSelectedName] = useState<string | undefined>(undefined);
    const [selectedContent, setSelectedContent] = useState<string>("");

    const [newName, setNewName] = useState<string>("ai_script");
    const [newPrompt, setNewPrompt] = useState<string>("");
    const [enableOnCreate, setEnableOnCreate] = useState<boolean>(true);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | undefined>(undefined);

    const selectedScript = useMemo(
        () => (selectedName ? scripts.find((s) => s.name === selectedName) : undefined),
        [scripts, selectedName],
    );

    const onClose = () => dispatch(modalActions.hideModal());

    const refreshList = async () => {
        setError(undefined);
        const res = await fetchApi("/ai/scripts", { method: "GET" });
        if (!res.ok) {
            throw new Error(`Request failed (${res.status}).`);
        }
        const data = (await res.json()) as ScriptsResponse;
        setScripts(data.scripts ?? []);
        setActivePaths(data.active ?? []);
    };

    const loadSelected = async (name: string) => {
        setError(undefined);
        const res = await fetchApi(`/ai/scripts/${encodeURIComponent(name)}`, {
            method: "GET",
        });
        if (!res.ok) {
            throw new Error(`Request failed (${res.status}).`);
        }
        const data = (await res.json()) as ScriptItemResponse;
        setSelectedName(data.name);
        setSelectedContent(data.content ?? "");
    };

    useEffect(() => {
        void (async () => {
            setLoading(true);
            try {
                await refreshList();
            } catch (e) {
                setError(String(e));
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const toggleSelected = async (enable: boolean) => {
        if (!selectedName) {
            return;
        }
        setLoading(true);
        setError(undefined);
        try {
            const res = await fetchApi(
                `/ai/scripts/${encodeURIComponent(selectedName)}/${enable ? "enable" : "disable"}`,
                { method: "POST" },
            );
            if (!res.ok) {
                throw new Error(`Request failed (${res.status}).`);
            }
            await refreshList();
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    const saveSelected = async () => {
        if (!selectedName) {
            return;
        }
        setLoading(true);
        setError(undefined);
        try {
            const res = await fetchApi(`/ai/scripts/${encodeURIComponent(selectedName)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: selectedContent }),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Request failed (${res.status}).`);
            }
            await refreshList();
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    const deleteSelected = async () => {
        if (!selectedName) {
            return;
        }
        if (!confirm(`Delete ${selectedName}?`)) {
            return;
        }
        setLoading(true);
        setError(undefined);
        try {
            const res = await fetchApi(`/ai/scripts/${encodeURIComponent(selectedName)}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Request failed (${res.status}).`);
            }
            setSelectedName(undefined);
            setSelectedContent("");
            await refreshList();
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    const createEmpty = async () => {
        setLoading(true);
        setError(undefined);
        try {
            const boilerplate =
                "from mitmproxy import http\n\n\ndef request(flow: http.HTTPFlow) -> None:\n    pass\n";
            const res = await fetchApi("/ai/scripts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newName,
                    content: boilerplate,
                    enable: enableOnCreate,
                }),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Request failed (${res.status}).`);
            }
            await refreshList();
            await loadSelected(newName.endsWith(".py") ? newName : `${newName}.py`);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    const generate = async () => {
        setLoading(true);
        setError(undefined);
        try {
            const res = await fetchApi("/ai/scripts/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName, prompt: newPrompt, enable: enableOnCreate }),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Request failed (${res.status}).`);
            }
            const data = (await res.json()) as ScriptItemResponse;
            await refreshList();
            setSelectedName(data.name);
            setSelectedContent(data.content ?? "");
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalLayout>
            <div>
                <div className="modal-header">
                    <button
                        type="button"
                        className="close"
                        data-dismiss="modal"
                        onClick={onClose}
                    >
                        <i className="fa fa-fw fa-times"></i>
                    </button>
                    <div className="modal-title">
                        <h4>AI Scripts</h4>
                    </div>
                </div>

                <div className="modal-body">
                    {error && <p className="small text-danger">{error}</p>}
                    {loading && <p className="small text-muted">Working…</p>}

                    <div className="row" style={{ display: "flex", gap: 16 }}>
                        <div className="col" style={{ flex: "0 0 260px" }}>
                            <h5>Scripts</h5>
                            <div className="list-group">
                                {scripts.map((s) => (
                                    <button
                                        key={s.name}
                                        type="button"
                                        className={
                                            "list-group-item" +
                                            (s.name === selectedName ? " active" : "")
                                        }
                                        onClick={() => void loadSelected(s.name)}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span>{s.name}</span>
                                            <span
                                                className={
                                                    "label " + (s.enabled ? "label-success" : "label-default")
                                                }
                                            >
                                                {s.enabled ? "On" : "Off"}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                                {scripts.length === 0 && (
                                    <div className="list-group-item text-muted small">
                                        No scripts yet.
                                    </div>
                                )}
                            </div>

                            <hr />

                            <h5>Create</h5>
                            <div className="form-group">
                                <label>Name</label>
                                <input
                                    className="form-control"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                />
                            </div>

                            <div className="checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={enableOnCreate}
                                        onChange={(e) => setEnableOnCreate(e.target.checked)}
                                    />{" "}
                                    Enable after create
                                </label>
                            </div>

                            <div className="form-group">
                                <label>AI prompt</label>
                                <textarea
                                    className="form-control"
                                    rows={5}
                                    value={newPrompt}
                                    onChange={(e) => setNewPrompt(e.target.value)}
                                    placeholder="Describe what the addon should do..."
                                />
                            </div>

                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    type="button"
                                    className="btn btn-default"
                                    onClick={() => void createEmpty()}
                                    disabled={loading}
                                >
                                    New empty
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={() => void generate()}
                                    disabled={loading || !newPrompt.trim()}
                                >
                                    Generate
                                </button>
                            </div>
                        </div>

                        <div className="col" style={{ flex: "1 1 auto" }}>
                            <h5>Active scripts</h5>
                            <pre style={{ whiteSpace: "pre-wrap" }}>
                                {(activePaths ?? []).join("\n") || "(none)"}
                            </pre>

                            <hr />

                            <h5>Editor</h5>
                            {selectedName ? (
                                <>
                                    <p className="small text-muted">{selectedScript?.path}</p>
                                    <textarea
                                        className="form-control"
                                        rows={14}
                                        value={selectedContent}
                                        onChange={(e) => setSelectedContent(e.target.value)}
                                        spellCheck={false}
                                    />
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: 8,
                                            justifyContent: "flex-end",
                                            marginTop: 10,
                                        }}
                                    >
                                        <button
                                            type="button"
                                            className="btn btn-default"
                                            onClick={() => void toggleSelected(false)}
                                            disabled={loading || !selectedScript?.enabled}
                                        >
                                            Disable
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-default"
                                            onClick={() => void toggleSelected(true)}
                                            disabled={loading || Boolean(selectedScript?.enabled)}
                                        >
                                            Enable
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={() => void saveSelected()}
                                            disabled={loading}
                                        >
                                            Save
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-danger"
                                            onClick={() => void deleteSelected()}
                                            disabled={loading}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-muted small">Select a script to view/edit it.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-default" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </ModalLayout>
    );
}
