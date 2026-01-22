import React, { useCallback, useEffect, useMemo, useState } from "react";
import ModalLayout from "./ModalLayout";
import { fetchApi } from "../../utils";
import * as modalActions from "../../ducks/ui/modal";
import { useAppDispatch } from "../../ducks";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";

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
    const [selectedPath, setSelectedPath] = useState<string | undefined>(undefined);
    const [selectedContent, setSelectedContent] = useState<string>("");

    const [newName, setNewName] = useState<string>("ai_script");
    const [newPrompt, setNewPrompt] = useState<string>("");
    const [enableOnCreate, setEnableOnCreate] = useState<boolean>(true);
    const [useSelectedAsBase, setUseSelectedAsBase] = useState<boolean>(true);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | undefined>(undefined);

    const selectedScript = useMemo(
        () => (selectedName ? scripts.find((s) => s.name === selectedName) : undefined),
        [scripts, selectedName],
    );

    const generateRandomName = useMemo(() => {
        return () => {
            const existing = new Set(scripts.map((s) => s.name));
            for (let i = 0; i < 20; i++) {
                const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
                const candidate = `ai_script_${suffix}.py`;
                if (!existing.has(candidate)) {
                    return candidate;
                }
            }
            return `ai_script_${Date.now()}.py`;
        };
    }, [scripts]);

    const onClose = () => dispatch(modalActions.hideModal());

    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                dispatch(modalActions.hideModal());
            }
        },
        [dispatch],
    );

    useEffect(() => {
        window.addEventListener("keydown", onKeyDown, true);
        return () => window.removeEventListener("keydown", onKeyDown, true);
    }, [onKeyDown]);

    const stopPropagation = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => e.stopPropagation(),
        [],
    );

    const normalizeName = useCallback((name: string) => {
        const trimmed = (name || "").trim();
        if (!trimmed) {
            return trimmed;
        }
        return trimmed.endsWith(".py") ? trimmed : `${trimmed}.py`;
    }, []);

    const pythonExtensions = useMemo(() => [python()], []);

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
        setSelectedPath(data.path);
        setSelectedContent(data.content ?? "");
        setNewName(data.name);
        setUseSelectedAsBase(true);
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
            const targetName = normalizeName(newName);
            if (!targetName) {
                throw new Error("Missing script name.");
            }

            if (targetName === selectedName) {
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
                return;
            }

            if (scripts.some((s) => s.name === targetName)) {
                throw new Error(`A script named ${targetName} already exists.`);
            }

            const createRes = await fetchApi("/ai/scripts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: targetName,
                    content: selectedContent,
                    enable: Boolean(selectedScript?.enabled),
                }),
            });
            if (!createRes.ok) {
                const text = await createRes.text();
                throw new Error(text || `Request failed (${createRes.status}).`);
            }
            const created = (await createRes.json()) as { name?: string };

            await refreshList();
            await loadSelected(created.name || targetName);
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
            setSelectedPath(undefined);
            setSelectedContent("");
            await refreshList();
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    const createEmpty = async () => {
        const name = generateRandomName();
        setNewName(name);
        setLoading(true);
        setError(undefined);
        try {
            const boilerplate =
                "from mitmproxy import http\n\n\ndef request(flow: http.HTTPFlow) -> None:\n    pass\n";
            const res = await fetchApi("/ai/scripts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    content: boilerplate,
                    enable: enableOnCreate,
                }),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Request failed (${res.status}).`);
            }
            const data = (await res.json()) as { name?: string };
            await refreshList();
            const createdName = data.name || name;
            await loadSelected(createdName);
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
            const normalizedNew = normalizeName(newName);
            const normalizedSelected = selectedName ? normalizeName(selectedName) : undefined;

            const effectiveName =
                useSelectedAsBase && selectedName
                    ? normalizedNew && normalizedSelected && normalizedNew !== normalizedSelected
                        ? normalizedNew
                        : selectedName
                    : newName;
            const res = await fetchApi("/ai/scripts/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: effectiveName,
                    prompt: newPrompt,
                    enable: enableOnCreate,
                    base_content:
                        useSelectedAsBase && selectedName ? selectedContent : undefined,
                }),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `Request failed (${res.status}).`);
            }
            const data = (await res.json()) as ScriptItemResponse;
            await refreshList();
            setSelectedName(data.name);
            setSelectedPath(data.path);
            setSelectedContent(data.content ?? "");
            setNewName(data.name);
            setUseSelectedAsBase(true);
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

                            <div className="checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={useSelectedAsBase && Boolean(selectedName)}
                                        onChange={(e) => setUseSelectedAsBase(e.target.checked)}
                                        disabled={!selectedName}
                                    />{" "}
                                    Use selected script as base
                                </label>
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
                                    <p className="small text-muted">
                                        <strong>{selectedName}</strong>
                                        <br />
                                        {selectedPath || selectedScript?.path}
                                    </p>
                                    <div
                                        onKeyDown={stopPropagation}
                                        style={{
                                            border: "1px solid #ccc",
                                            borderRadius: 4,
                                        }}
                                    >
                                        <CodeMirror
                                            value={selectedContent}
                                            onChange={setSelectedContent}
                                            extensions={pythonExtensions}
                                        />
                                    </div>
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
