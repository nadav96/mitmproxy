import React, { useMemo } from "react";
import ModalLayout from "./ModalLayout";
import { useAppDispatch, useAppSelector } from "../../ducks";
import * as modalActions from "../../ducks/ui/modal";
import { startFlowSummaryScan } from "../../ducks/aiFlowSummaries";

export default function AIFlowSummaryScanModal() {
    const dispatch = useAppDispatch();
    const flowCount = useAppSelector((state) => state.flows.list.length);
    const scan = useAppSelector((state) => state.aiFlowSummaries.scan);

    const maxFlows = useMemo(() => Math.min(flowCount || 0, 500), [flowCount]);

    const onClose = () => dispatch(modalActions.hideModal());
    const onScan = () => {
        if (!scan.running) {
            dispatch(startFlowSummaryScan(maxFlows));
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
                        <h4>AI Flow Summaries</h4>
                    </div>
                </div>

                <div className="modal-body">
                    <p>
                        Do you want to scan the current flows and generate a short summary for
                        each request/response?
                    </p>
                    <p className="small text-muted">
                        Flows in memory: <strong>{flowCount}</strong>. This will scan up to{" "}
                        <strong>{maxFlows}</strong> flows.
                    </p>
                    {scan.running && (
                        <p className="small">
                            Scan in progress: <strong>{scan.done}</strong> /{" "}
                            <strong>{scan.total}</strong>
                        </p>
                    )}
                    {scan.error && <p className="small text-danger">{scan.error}</p>}
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-default" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={onScan}
                        disabled={scan.running}
                    >
                        {scan.running ? "Scanning…" : "Scan"}
                    </button>
                </div>
            </div>
        </ModalLayout>
    );
}
